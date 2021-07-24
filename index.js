'use strict';

const util = require('util');
const { ethers, BigNumber } = require('ethers');
const UniswapERC20 = require('./contracts/UniswapERC20');

require('dotenv').config();

global.fetch = require('node-fetch');

// const archiveNode = new ethers.providers.InfuraProvider('mainnet', process.env.INFURA_ARCHIVE_KEY);

const {
	Wallet,
	providers: { FallbackProvider, InfuraProvider, EtherscanProvider },
} = ethers;

const getProvider = () => {
	const provider = new FallbackProvider([
		new InfuraProvider('mainnet', process.env.INFURA_ARCHIVE_KEY),
		new EtherscanProvider('mainnet', process.env.ETHERSCAN_KEY),
	]);
	return provider;
};

const main = async () => {
	/*
		Uniswap Token Contract: https://etherscan.io/address/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984#code

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(address indexed delegate, uint previousBalance, uint newBalance);
  */

	/*
  1. Get the beginning block hash and ending block hash of the defined epoch
  2. Map through the tx's of the uniswap contract and only get the two events from above
  3. Go through each of the events, first we want to listen for DelegateChanged to see when users delegate specifically to the ambassadorDAO multisig
  4. From this event above we want to see how much the new delegation added in terms of voting weight
  5. We want to add this change of delegation to the users balance
  6. Any change of delegations, that is when the DelegateChanged goes from ambassadorDAO to another one we want to then immediately slash their balance
  7. By the end of the script we need to split the rewards evenly from whoever delegated and how much they've delegated by the end of it
  */

	// let mnemonicWallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);

	const delegatesObject = {};

	const ambassadorDAO = '0x8962285fAac45a7CBc75380c484523Bb7c32d429';

	const startBlock = undefined;

	const endBlock = undefined;

	const totalRewards = 32000;

	const provider = getProvider();

	const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

	const contract = new ethers.Contract(UniswapERC20.address, UniswapERC20.abi, wallet);

	/*
		Find all the delegation events to the ambassadorDAO multisig
	*/

	const delegateChangedToAmbassadorFilter = contract.filters.DelegateChanged(
		null,
		null,
		ethers.utils.getAddress(ambassadorDAO),
	);

	const delegateChangedFromAmbassadorFilter = contract.filters.DelegateChanged(
		null,
		ethers.utils.getAddress(ambassadorDAO),
		null,
	);

	const delegateChangedToAmbassadorEvents = await contract.queryFilter(
		delegateChangedToAmbassadorFilter,
		startBlock,
		endBlock,
	);

	const delegateChangedFromAmbassadorEvents = await contract.queryFilter(
		delegateChangedFromAmbassadorFilter,
		startBlock,
		endBlock,
	);

	const allDelegationEvents = delegateChangedToAmbassadorEvents
		.concat(delegateChangedFromAmbassadorEvents)
		.sort((a, b) => a.blockNumber - b.blockNumber);

	let totalDelegationAdded = ethers.BigNumber.from('0');

	for (let i = 0; i < allDelegationEvents.length; i++) {
		const eventAtIndex = allDelegationEvents[i];
		const { delegator } = eventAtIndex.args;
		const { blockNumber } = eventAtIndex;

		const checkSummedAddress = ethers.utils.getAddress(delegator);

		const receipt = await eventAtIndex.getTransactionReceipt();

		const iface = new ethers.utils.Interface(UniswapERC20.abi);

		const delegateVotesChangedTopic = contract.filters.DelegateVotesChanged().topics[0];

		receipt.logs.forEach(log => {
			if (
				log.topics[0] === delegateVotesChangedTopic &&
				ethers.utils.getAddress(ethers.utils.hexStripZeros(log.topics[1])) === ethers.utils.getAddress(ambassadorDAO)
			) {
				const data = iface.decodeEventLog('DelegateVotesChanged', log.data);
				const previousBalance = ethers.BigNumber.from(data.previousBalance);
				const newBalance = ethers.BigNumber.from(data.newBalance);
				const differenceInBalance = newBalance.sub(previousBalance);

				totalDelegationAdded = totalDelegationAdded.add(differenceInBalance);

				if (delegatesObject[checkSummedAddress]) {
					// Means another delegation event happened, we should check if the user added or removed balance
					// If they've added more balance maintain the existing blockNumber as they shouldn't be penalised for adding more balance later
					// If they've remove balance the blockNumber should be updated as they should be treated like a original delegation event

					const newBalance = delegatesObject[checkSummedAddress].additionalBalance.add(differenceInBalance);

					if (newBalance.lt(delegatesObject[checkSummedAddress].additionalBalance)) {
						delegatesObject[checkSummedAddress].blockNumber = blockNumber;
					}

					delegatesObject[checkSummedAddress].additionalBalance = newBalance;
					delegatesObject[checkSummedAddress].additionalBalanceString = newBalance.toString();
				} else {
					delegatesObject[checkSummedAddress] = {
						address: checkSummedAddress,
						additionalBalance: differenceInBalance,
						additionalBalanceString: differenceInBalance.toString(),
						blockNumber,
					};
				}
			}
		});
	}

	/*
		Map values to readable format
	*/

	/*
		Values needed

		{
			address: 0x,
			proportion: 0.03 (their balance/total delegation)
			timePenalty: 0.10 (
				(endBlock - entryBlock) /
				endBlock - startBlock
			)
			entitledRewards: 2000 (maxRewards * (proportion * penalty))
		}
	*/

	console.log(util.inspect(delegatesObject, false, null, true /* enable colors */));

	console.log(Object.keys(delegatesObject).length);

	console.log(totalDelegationAdded.toString());

	// console.log(Object.values(delegatesObject));

	// console.log(totalDelegationAdded.toString());

	// const countOfDelegates = Object.values(delegatesObject).filter(e => e.eligible).length;

	// console.log(countOfDelegates);
};

main()
	.then(response => {
		// console.log(response);
		process.exit(0);
	})
	.catch(error => {
		console.log(error.message);
		process.exit(1);
	});
