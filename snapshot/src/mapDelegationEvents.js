const { ethers } = require('ethers');
const UniswapERC20 = require('../abis/UniswapERC20');

const mapDelegationEvents = async (events, startBlock, endBlock, totalRewards, ambassadorDAO) => {
	const sortedDelegators = [];
	const mappedDelegatesObject = {};

	let totalSupply = 0;
	let nextBlockNumber;
	let currentBlockNumber;
	let remainingRewards = totalRewards;

	const rewardsPerBlock = (currentEndBlock, currentStartBlock) => {
		return remainingRewards / (currentEndBlock - currentStartBlock);
	};

	const proRataRewardsForBlocks = shareOfPool => {
		return (shareOfPool / totalSupply) * currentRewardsPerBlock * (nextBlockNumber - currentBlockNumber);
	};

	let currentRewardsPerBlock = rewardsPerBlock(endBlock, startBlock);

	for (let i = 0; i < events.length; i++) {
		const eventAtIndex = events[i];
		const { delegator } = eventAtIndex.args;
		currentBlockNumber = eventAtIndex.blockNumber;

		const checkSummedAddress = ethers.utils.getAddress(delegator);

		const receipt = await eventAtIndex.getTransactionReceipt();

		const iface = new ethers.utils.Interface(UniswapERC20.abi);

		if (i + 1 < events.length) {
			nextBlockNumber = events[i + 1].blockNumber;
		} else {
			nextBlockNumber = endBlock;
		}

		if (events.length === 1) {
			mappedDelegatesObject[checkSummedAddress] = {
				address: checkSummedAddress,
				allocatedRewards: totalRewards,
				totalContribution: 0,
			};
			break;
		}

		receipt.logs.forEach(log => {
			let parsedLog;

			try {
				parsedLog = iface.parseLog(log);
			} catch (e) {
				console.log(e);
				return;
			}

			if (
				parsedLog.name === 'DelegateVotesChanged' &&
				ethers.utils.getAddress(parsedLog.args['delegate']) === ethers.utils.getAddress(ambassadorDAO)
			) {
				const previousBalance = Number(ethers.utils.formatEther(parsedLog.args['previousBalance']));
				const newBalance = Number(ethers.utils.formatEther(parsedLog.args['newBalance']));
				const differenceInTotalSupply = newBalance - previousBalance;
				totalSupply = totalSupply + differenceInTotalSupply;

				if (differenceInTotalSupply !== 0) {
					// We recognise delegation events from already tracked delegators
					if (mappedDelegatesObject[checkSummedAddress]) {
						const newBalance = mappedDelegatesObject[checkSummedAddress].totalContribution + differenceInTotalSupply;

						// Slash them if they're contribution reaches zero, rewardsPerBlock and remaining rewards should shift
						if (newBalance <= 0) {
							remainingRewards += mappedDelegatesObject[checkSummedAddress].allocatedRewards;

							currentRewardsPerBlock = rewardsPerBlock(endBlock, currentBlockNumber);

							mappedDelegatesObject[checkSummedAddress] = {
								...mappedDelegatesObject[checkSummedAddress],
								allocatedRewards: 0,
								totalContribution: 0,
							};
						} else {
							const updatedAllocation =
								mappedDelegatesObject[checkSummedAddress].allocatedRewards +
								proRataRewardsForBlocks(differenceInTotalSupply);

							remainingRewards -= proRataRewardsForBlocks(differenceInTotalSupply);

							mappedDelegatesObject[checkSummedAddress] = {
								...mappedDelegatesObject[checkSummedAddress],
								allocatedRewards: updatedAllocation,
								totalContribution: newBalance,
							};
						}

						// Any delegate before the delegation event must be recalculated with the new block rewards
						sortedDelegators.forEach(element => {
							if (ethers.utils.getAddress(element) !== checkSummedAddress) {
								const updatedAllocation =
									mappedDelegatesObject[element].allocatedRewards +
									proRataRewardsForBlocks(mappedDelegatesObject[element].totalContribution);

								remainingRewards -= proRataRewardsForBlocks(mappedDelegatesObject[element].totalContribution);

								mappedDelegatesObject[element].allocatedRewards = updatedAllocation;
							}
						});
					} else {
						mappedDelegatesObject[checkSummedAddress] = {
							address: checkSummedAddress,
							allocatedRewards: proRataRewardsForBlocks(differenceInTotalSupply),
							totalContribution: differenceInTotalSupply,
						};

						remainingRewards -= proRataRewardsForBlocks(differenceInTotalSupply);

						sortedDelegators.forEach(element => {
							const updatedAllocation =
								mappedDelegatesObject[element].allocatedRewards +
								proRataRewardsForBlocks(mappedDelegatesObject[element].totalContribution);

							remainingRewards -= proRataRewardsForBlocks(mappedDelegatesObject[element].totalContribution);

							mappedDelegatesObject[element].allocatedRewards = updatedAllocation;
						});

						sortedDelegators.push(checkSummedAddress);
					}
				}
			}
		});
	}
	return mappedDelegatesObject;
};

module.exports = mapDelegationEvents;
