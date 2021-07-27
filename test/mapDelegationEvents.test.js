const mapDelegationEvents = require('../src/mapDelegationEvents');

const { ethers } = require('ethers');
const UniswapERC20 = require('../contracts/UniswapERC20');

const getTransactionReceipt = async (ambassadorDAO, previousBalance, newBalance, blockNumber) => {
	const iface = new ethers.utils.Interface(UniswapERC20.abi);
	const encodedData = iface.encodeEventLog('DelegateVotesChanged', [
		ambassadorDAO,
		previousBalance.toString(),
		newBalance.toString(),
	]);
	return {
		logs: [
			{
				blockNumber: blockNumber,
				address: UniswapERC20.address,
				topics: encodedData.topics,
				data: encodedData.data,
			},
		],
	};
};

describe('test events return correct reward allocation', () => {
	let events;
	let startBlock;
	let endBlock;
	let totalRewards;
	let ambassadorDAO;

	const delegatorOne = ethers.Wallet.createRandom().address;
	const delegatorTwo = ethers.Wallet.createRandom().address;
	const delegatorThree = ethers.Wallet.createRandom().address;
	const delegatorFour = ethers.Wallet.createRandom().address;

	beforeEach(() => {
		startBlock = 0; // arbitrary start block
		endBlock = 193_710; // end block is approximately 30 days later
		ambassadorDAO = '0x46abFE1C972fCa43766d6aD70E1c1Df72F4Bb4d1'; // the ambassadorDAO multisig
		totalRewards = 32_000; // the total amount of rewards for this incentive
	});

	it('should handle two events with no undelegation', async () => {
		startBlock = 1000;
		endBlock = 2000;
		const eventOneBlock = 1000;
		const eventTwoBlock = 1500;
		const startingBalance = `0`;
		const delegatorOneBalance = ethers.utils.parseEther('50');
		const delegatorTwoBalance = ethers.utils.parseEther('50');
		const eventOneNewBalance = delegatorOneBalance;
		const eventTwoNewBalance = delegatorOneBalance.add(delegatorTwoBalance);

		events = [
			{
				blockNumber: eventOneBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, startingBalance, eventOneNewBalance, eventOneBlock),
			},
			{
				blockNumber: eventTwoBlock,
				args: {
					delegator: delegatorTwo,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventOneNewBalance, eventTwoNewBalance, eventTwoBlock),
			},
		];

		expect(await mapDelegationEvents(events, startBlock, endBlock, totalRewards, ambassadorDAO)).toEqual({
			[delegatorOne]: {
				address: delegatorOne,
				allocatedRewards: ethers.BigNumber.from('24000'),
				allocatedRewardsString: '24000',
				totalContribution: delegatorOneBalance,
				totalContributionString: delegatorOneBalance.toString(),
			},
			[delegatorTwo]: {
				address: delegatorTwo,
				allocatedRewards: ethers.BigNumber.from('8000'),
				allocatedRewardsString: '8000',
				totalContribution: delegatorTwoBalance,
				totalContributionString: delegatorTwoBalance.toString(),
			},
		});
	});

	it('should handle three events with no undelegation', async () => {
		startBlock = 1000;
		endBlock = 2000;
		const eventOneBlock = 1000;
		const eventTwoBlock = 1250;
		const eventThreeBlock = 1300;
		const startingBalance = `0`;
		const delegatorOneBalance = ethers.utils.parseEther('10');
		const delegatorTwoBalance = ethers.utils.parseEther('50');
		const delegatorThreeBalance = ethers.utils.parseEther('200');

		const eventOneNewBalance = delegatorOneBalance;
		const eventTwoNewBalance = eventOneNewBalance.add(delegatorTwoBalance);
		const eventThreeNewBalance = eventTwoNewBalance.add(delegatorThreeBalance);

		events = [
			{
				blockNumber: eventOneBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, startingBalance, eventOneNewBalance, eventOneBlock),
			},
			{
				blockNumber: eventTwoBlock,
				args: {
					delegator: delegatorTwo,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventOneNewBalance, eventTwoNewBalance, eventTwoBlock),
			},
			{
				blockNumber: eventThreeBlock,
				args: {
					delegator: delegatorThree,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventTwoNewBalance, eventThreeNewBalance, eventThreeBlock),
			},
		];

		expect(await mapDelegationEvents(events, startBlock, endBlock, totalRewards, ambassadorDAO)).toEqual({
			[delegatorOne]: {
				address: delegatorOne,
				allocatedRewards: ethers.BigNumber.from('9127'),
				allocatedRewardsString: '9127',
				totalContribution: delegatorOneBalance,
				totalContributionString: delegatorOneBalance.toString(),
			},
			[delegatorTwo]: {
				address: delegatorTwo,
				allocatedRewards: ethers.BigNumber.from('5640'),
				allocatedRewardsString: '5640',
				totalContribution: delegatorTwoBalance,
				totalContributionString: delegatorTwoBalance.toString(),
			},
			[delegatorThree]: {
				address: delegatorThree,
				allocatedRewards: ethers.BigNumber.from('17230'),
				allocatedRewardsString: '17230',
				totalContribution: delegatorThreeBalance,
				totalContributionString: delegatorThreeBalance.toString(),
			},
		});
	});

	it.only('should handle undelegation', async () => {
		startBlock = 1000;
		endBlock = 2000;
		const eventOneBlock = 1000;
		const eventTwoBlock = 1250;
		const eventThreeBlock = 1300;
		const eventFourBlock = 1700;

		const startingBalance = `0`;

		const delegatorOneBalance = ethers.utils.parseEther('10');
		const delegatorTwoBalance = ethers.utils.parseEther('50');
		const delegatorThreeBalance = ethers.utils.parseEther('200');

		// const eventOneNewBalance = delegatorOneBalance;
		// const eventTwoNewBalance = eventOneNewBalance.add(delegatorTwoBalance);
		// const eventThreeNewBalance = eventTwoNewBalance.add(delegatorThreeBalance);

		events = [
			{
				blockNumber: eventOneBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, startingBalance, delegatorOneBalance, eventOneBlock),
			},
			{
				blockNumber: eventTwoBlock,
				args: {
					delegator: delegatorTwo,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(
						ambassadorDAO,
						delegatorOneBalance,
						delegatorOneBalance.add(delegatorTwoBalance),
						eventTwoBlock,
					),
			},
			{
				blockNumber: eventThreeBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(
						ambassadorDAO,
						delegatorOneBalance.add(delegatorTwoBalance),
						delegatorTwoBalance,
						eventThreeBlock,
					),
			},
			{
				blockNumber: eventFourBlock,
				args: {
					delegator: delegatorThree,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(
						ambassadorDAO,
						delegatorTwoBalance,
						delegatorTwoBalance.add(delegatorThreeBalance),
						eventFourBlock,
					),
			},
		];

		expect(await mapDelegationEvents(events, startBlock, endBlock, totalRewards, ambassadorDAO)).toEqual({
			[delegatorOne]: {
				address: delegatorOne,
				allocatedRewards: ethers.BigNumber.from('0'),
				allocatedRewardsString: '0',
				totalContribution: ethers.BigNumber.from('0'),
				totalContributionString: '0',
			},
			[delegatorTwo]: {
				address: delegatorTwo,
				allocatedRewards: ethers.BigNumber.from('0'),
				allocatedRewardsString: '0',
				totalContribution: delegatorTwoBalance,
				totalContributionString: delegatorTwoBalance.toString(),
			},
			[delegatorThree]: {
				address: delegatorThree,
				allocatedRewards: ethers.BigNumber.from('10971'),
				allocatedRewardsString: '10971',
				totalContribution: delegatorThreeBalance,
				totalContributionString: delegatorThreeBalance.toString(),
			},
		});
	});
});
