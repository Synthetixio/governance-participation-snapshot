const { ethers } = require('ethers');
const UniswapERC20 = require('../contracts/UniswapERC20');

async function mapDelegationEvents(
	events,
	delegateVotesChangedTopic,
	startBlock,
	endBlock,
	totalRewards,
	ambassadorDAO,
) {
	const ZeroBigNumber = ethers.BigNumber.from('0');
	const sortedDelegators = [];
	const rewardsPerBlock = ethers.utils.parseEther((totalRewards / (endBlock - startBlock)).toString());
	const mappedDelegatesObject = {};

	let totalSupply = ZeroBigNumber;

	for (let i = 0; i < events.length; i++) {
		const eventAtIndex = events[i];
		const { delegator } = eventAtIndex.args;
		const { blockNumber } = eventAtIndex;

		const checkSummedAddress = ethers.utils.getAddress(delegator);

		const receipt = await eventAtIndex.getTransactionReceipt();

		const iface = new ethers.utils.Interface(UniswapERC20.abi);

		const proRataRewardsForBlocks = shareOfPool => {
			return shareOfPool
				.div(totalSupply)
				.mul(rewardsPerBlock)
				.mul(nextBlockNumber - blockNumber);
		};

		let nextBlockNumber;
		if (i + 1 < events.length) {
			nextBlockNumber = events[i + 1].blockNumber;
		} else {
			nextBlockNumber = endBlock;
		}

		if (events.length === 1) {
			const totalRewardsBN = ethers.utils.parseEther(totalRewards.toString());
			mappedDelegatesObject[checkSummedAddress] = {
				address: checkSummedAddress,
				allocatedRewards: totalRewardsBN,
				allocatedRewardsString: totalRewardsBN.toString(),
				totalContribution: ZeroBigNumber,
				totalContributionString: ZeroBigNumber.toString(),
			};
			break;
		}

		receipt.logs.forEach(log => {
			if (
				log.topics[0] === delegateVotesChangedTopic &&
				ethers.utils.getAddress(ethers.utils.hexStripZeros(log.topics[1])) === ethers.utils.getAddress(ambassadorDAO)
			) {
				const data = iface.decodeEventLog('DelegateVotesChanged', log.data);
				const previousBalance = ethers.BigNumber.from(data.previousBalance);
				const newBalance = ethers.BigNumber.from(data.newBalance);
				const differenceInTotalSupply = newBalance.sub(previousBalance);
				totalSupply = totalSupply.add(differenceInTotalSupply);

				if (!differenceInTotalSupply.eq(ZeroBigNumber)) {
					// We recognise delegation events from already tracked delegators
					if (mappedDelegatesObject[checkSummedAddress]) {
						const newBalance = mappedDelegatesObject[checkSummedAddress].totalContribution.add(differenceInTotalSupply);

						// Slash them if they're contribution reaches zero
						if (newBalance.lte(ZeroBigNumber)) {
							mappedDelegatesObject[checkSummedAddress] = {
								...mappedDelegatesObject[checkSummedAddress],
								allocatedRewards: ZeroBigNumber,
								allocatedRewardsString: ZeroBigNumber.toString(),
								totalContribution: ZeroBigNumber,
								totalContributionString: ZeroBigNumber.toString(),
							};
						} else {
							const updatedAllocation = mappedDelegatesObject[checkSummedAddress].allocatedRewards.add(
								proRataRewardsForBlocks(differenceInTotalSupply),
							);
							mappedDelegatesObject[checkSummedAddress] = {
								...mappedDelegatesObject[checkSummedAddress],
								allocatedRewards: updatedAllocation,
								allocatedRewardsString: updatedAllocation.toString(),
								totalContribution: newBalance,
								totalContributionString: newBalance.toString(),
							};
						}

						sortedDelegators.forEach(element => {
							if (ethers.utils.getAddress(element) !== checkSummedAddress) {
								const updatedAllocation = mappedDelegatesObject[element].allocatedRewards.add(
									proRataRewardsForBlocks(mappedDelegatesObject[element].totalContribution),
								);
								mappedDelegatesObject[element].allocatedRewards = updatedAllocation;
								mappedDelegatesObject[element].allocatedRewardsString = updatedAllocation.toString();
							}
						});
					} else {
						mappedDelegatesObject[checkSummedAddress] = {
							address: checkSummedAddress,
							allocatedRewards: proRataRewardsForBlocks(differenceInTotalSupply),
							allocatedRewardsString: proRataRewardsForBlocks(differenceInTotalSupply).toString(),
							totalContribution: differenceInTotalSupply,
							totalContributionString: differenceInTotalSupply.toString(),
						};

						sortedDelegators.forEach(element => {
							const updatedAllocation = mappedDelegatesObject[element].allocatedRewards.add(
								proRataRewardsForBlocks(mappedDelegatesObject[element].totalContribution),
							);
							mappedDelegatesObject[element].allocatedRewards = updatedAllocation;
							mappedDelegatesObject[element].allocatedRewardsString = updatedAllocation.toString();
						});
						sortedDelegators.push(checkSummedAddress);
					}
				}
			}
		});
	}
	return mappedDelegatesObject;
}

module.exports = mapDelegationEvents;
