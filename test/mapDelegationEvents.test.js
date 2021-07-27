const { ethers } = require('ethers');
const UniswapERC20 = require('../contracts/UniswapERC20');
const mapDelegationEvents = require('../src/mapDelegationEvents');

const getTransactionReceipt = async (ambassadorDAO, previousBalance, newBalance, blockNumber) => {
	const iface = new ethers.utils.Interface(UniswapERC20.abi);
	const encodedData = iface.encodeEventLog('DelegateVotesChanged', [
		ambassadorDAO,
		ethers.utils.parseEther(previousBalance.toString()),
		ethers.utils.parseEther(newBalance.toString()),
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

const checkRewardOverflow = (object, totalRewards) => {
	const sumOfRewards = Object.values(object).reduce((a, b) => {
		return a + b.allocatedRewards;
	}, 0);
	expect(sumOfRewards).toBeLessThanOrEqual(totalRewards);
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
		ambassadorDAO = '0x46abFE1C972fCa43766d6aD70E1c1Df72F4Bb4d1'; // the ambassadorDAO multisig
		totalRewards = 32_000; // the total amount of rewards for this incentive
	});

	it('should handle one delegation event successfully', async () => {
		startBlock = 1000;
		endBlock = 2000;
		const eventOneBlock = 1500;
		const startingBalance = 0;
		const delegatorOneBalance = 50;

		events = [
			{
				blockNumber: eventOneBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, startingBalance, delegatorOneBalance, eventOneBlock),
			},
		];

		expect(await mapDelegationEvents(events, startBlock, endBlock, totalRewards, ambassadorDAO)).toEqual({
			[delegatorOne]: {
				address: delegatorOne,
				allocatedRewards: totalRewards,
				totalContribution: 0,
			},
		});
	});

	it('should handle two events with no undelegation successfully', async () => {
		startBlock = 1000;
		endBlock = 2000;
		const eventOneBlock = 1000;
		const eventTwoBlock = 1500;
		const startingBalance = 0;
		const delegatorOneBalance = 50;
		const delegatorTwoBalance = 50;
		const eventOneNewBalance = delegatorOneBalance;
		const eventTwoNewBalance = delegatorOneBalance + delegatorTwoBalance;

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

		const delegationObject = await mapDelegationEvents(events, startBlock, endBlock, totalRewards, ambassadorDAO);

		checkRewardOverflow(delegationObject, totalRewards);

		expect(delegationObject).toEqual({
			[delegatorOne]: {
				address: delegatorOne,
				allocatedRewards: 24000,
				totalContribution: delegatorOneBalance,
			},
			[delegatorTwo]: {
				address: delegatorTwo,
				allocatedRewards: 8000,
				totalContribution: delegatorTwoBalance,
			},
		});
	});

	it('should handle three events with no undelegation successfully', async () => {
		startBlock = 1000;
		endBlock = 2000;
		const eventOneBlock = 1000;
		const eventTwoBlock = 1250;
		const eventThreeBlock = 1300;
		const startingBalance = 0;
		const delegatorOneBalance = 10;
		const delegatorTwoBalance = 50;
		const delegatorThreeBalance = 200;

		const eventOneNewBalance = delegatorOneBalance;
		const eventTwoNewBalance = eventOneNewBalance + delegatorTwoBalance;
		const eventThreeNewBalance = eventTwoNewBalance + delegatorThreeBalance;

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

		const delegationObject = await mapDelegationEvents(events, startBlock, endBlock, totalRewards, ambassadorDAO);

		checkRewardOverflow(delegationObject, totalRewards);

		expect(delegationObject).toEqual({
			[delegatorOne]: {
				address: delegatorOne,
				allocatedRewards: 9128.205128205127,
				totalContribution: delegatorOneBalance,
			},
			[delegatorTwo]: {
				address: delegatorTwo,
				allocatedRewards: 5641.025641025641,
				totalContribution: delegatorTwoBalance,
			},
			[delegatorThree]: {
				address: delegatorThree,
				allocatedRewards: 17230.76923076923,
				totalContribution: delegatorThreeBalance,
			},
		});
	});

	it('should handle undelegation event in the middle of the sequence successfully', async () => {
		startBlock = 1000;
		endBlock = 2000;
		const eventOneBlock = 1000;
		const eventTwoBlock = 1250;
		const eventThreeBlock = 1300;
		const eventFourBlock = 1700;

		const startingBalance = 0;
		const delegatorOneBalance = 10;
		const delegatorTwoBalance = 50;
		const delegatorThreeBalance = 200;

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
						delegatorOneBalance + delegatorTwoBalance,
						eventTwoBlock,
					),
			},
			// Undelegation event happens here
			{
				blockNumber: eventThreeBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(
						ambassadorDAO,
						delegatorOneBalance + delegatorTwoBalance,
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
						delegatorTwoBalance + delegatorThreeBalance,
						eventFourBlock,
					),
			},
		];

		const delegationObject = await mapDelegationEvents(events, startBlock, endBlock, totalRewards, ambassadorDAO);

		checkRewardOverflow(delegationObject, totalRewards);

		expect(delegationObject).toEqual({
			[delegatorOne]: {
				address: delegatorOne,
				allocatedRewards: 0,
				totalContribution: 0,
			},
			[delegatorTwo]: {
				address: delegatorTwo,
				allocatedRewards: 21485.714285714283,
				totalContribution: delegatorTwoBalance,
			},
			[delegatorThree]: {
				address: delegatorThree,
				allocatedRewards: 10514.285714285714,
				totalContribution: delegatorThreeBalance,
			},
		});
	});

	it('should handle multiple delegation and undelegation events successfully', async () => {
		startBlock = 0; // zero start block
		endBlock = 193_710; // end block is approximately 30 days later

		const eventOneBlock = 100;
		const eventTwoBlock = 1000;
		const eventThreeBlock = 20_000;
		const eventFourBlock = 32_000;
		const eventFiveBlock = 100_000;
		const eventSixBlock = 140_000;
		const eventSevenBlock = 165_000;

		const startingBalance = 1_000_000;
		const delegatorOneBalance = 50_000;
		const delegatorTwoBalance = 2_500;
		const delegatorThreeBalance = 10_000;
		const delegatorFourBalance = 2_000_000;

		// delegatorOne delgates their balance
		const eventOneBalance = startingBalance + delegatorOneBalance;
		// delegatorTwo delgates their balance
		const eventTwoBalance = eventOneBalance + delegatorTwoBalance;
		// delegatorOne undelegates their balance
		const eventThreeBalance = eventTwoBalance - delegatorOneBalance;
		// delegatorThree delegates their balance
		const eventFourBalance = eventThreeBalance + delegatorThreeBalance;
		// delegatorTwo undelegates their balance
		const eventFiveBalance = eventFourBalance - delegatorTwoBalance;
		// delegatorOne delegates their balance again
		const eventSixBalance = eventFiveBalance + delegatorOneBalance;
		// delegatorFour delegates their balance
		const eventSevenBalance = eventSixBalance + delegatorFourBalance;

		events = [
			// delegatorOne delgates their balance
			{
				blockNumber: eventOneBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, startingBalance, eventOneBalance, eventOneBlock),
			},
			// delegatorTwo delgates their balance
			{
				blockNumber: eventTwoBlock,
				args: {
					delegator: delegatorTwo,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventOneBalance, eventTwoBalance, eventTwoBlock),
			},
			// delegatorOne undelegates all their balance
			{
				blockNumber: eventThreeBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventTwoBalance, eventThreeBalance, eventThreeBlock),
			},
			// delegatorThree delegates their balance
			{
				blockNumber: eventFourBlock,
				args: {
					delegator: delegatorThree,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventThreeBalance, eventFourBalance, eventFourBlock),
			},
			// delegatorTwo undelegates their balance
			{
				blockNumber: eventFiveBlock,
				args: {
					delegator: delegatorTwo,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventFourBalance, eventFiveBalance, eventFiveBlock),
			},
			// delegatorOne delegates their balance again
			{
				blockNumber: eventSixBlock,
				args: {
					delegator: delegatorOne,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventFiveBalance, eventSixBalance, eventSixBlock),
			},
			// delegatorFour delegates their balance
			{
				blockNumber: eventSevenBlock,
				args: {
					delegator: delegatorFour,
				},
				getTransactionReceipt: () =>
					getTransactionReceipt(ambassadorDAO, eventSixBalance, eventSevenBalance, eventSevenBlock),
			},
		];

		const delegationObject = await mapDelegationEvents(events, startBlock, endBlock, totalRewards, ambassadorDAO);

		checkRewardOverflow(delegationObject, totalRewards);

		expect(delegationObject).toEqual({
			[delegatorOne]: {
				address: delegatorOne,
				allocatedRewards: 5060.431955539014,
				totalContribution: delegatorOneBalance,
			},
			[delegatorTwo]: {
				address: delegatorTwo,
				allocatedRewards: 0,
				totalContribution: 0,
			},
			[delegatorThree]: {
				address: delegatorThree,
				allocatedRewards: 20388.140578225586,
				totalContribution: delegatorThreeBalance,
			},
			[delegatorFour]: {
				address: delegatorFour,
				allocatedRewards: 6551.4274662354,
				totalContribution: delegatorFourBalance,
			},
		});
	});
});
