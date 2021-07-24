const util = require('util');
const { ethers } = require('ethers');
const UniswapERC20 = require('../contracts/UniswapERC20');
const mapDelegationEvents = require('./mapDelegationEvents.js');

require('dotenv').config();

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

		1. Get the beginning block hash and ending block hash of the defined epoch
		2. Map through the tx's of the uniswap contract and only get the two events from above
		3. Go through each of the events, first we want to listen for DelegateChanged to see when users delegate specifically to the ambassadorDAO multisig
		4. From this event above we want to see how much the new delegation added in terms of voting weight
		5. We want to add this change of delegation to the users balance
		6. Any change of delegations, that is when the DelegateChanged goes from ambassadorDAO to another one we want to then immediately slash their balance
		7. By the end of the script we need to split the rewards evenly from whoever delegated and how much they've delegated by the end of it
  */

	// const archiveNode = new ethers.providers.InfuraProvider('mainnet', process.env.INFURA_ARCHIVE_KEY);

	// let mnemonicWallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);

	// const ambassadorDAO = '0x8962285fAac45a7CBc75380c484523Bb7c32d429';
	const ambassadorDAO = '0x7064d1fa592fa9d50c06c6e1a3f79399f12cfaf3';

	const startBlock = 12855422;

	const endBlock = 12888159;

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

	const delegateVotesChangedTopic = contract.filters.DelegateVotesChanged().topics[0];

	const allDelegationEvents = delegateChangedToAmbassadorEvents
		.concat(delegateChangedFromAmbassadorEvents)
		.sort((a, b) => a.blockNumber - b.blockNumber);

	let delegatesObject = await mapDelegationEvents(
		allDelegationEvents,
		delegateVotesChangedTopic,
		startBlock,
		endBlock,
		totalRewards,
		ambassadorDAO,
	);

	return delegatesObject;
};

main()
	.then(response => {
		console.log(util.inspect(response, false, null, true /* enable colors */));
		process.exit(0);
	})
	.catch(error => {
		console.log(error);
		process.exit(1);
	});
