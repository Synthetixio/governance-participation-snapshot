const hre = require('hardhat');

async function main() {
	// @TODO: change root
	const merkleRoot = '0xc0615dba6c9cd4e05f81337e7b0412084337bb2cbe1126f2686fa7cbd87c1c0e';
	const token = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f';

	const Merkle = await hre.ethers.getContractFactory('MerkleClaimTree');
	const merkle = await Merkle.deploy(token, merkleRoot);

	await merkle.deployed();

	console.log('Merkle deployed to:', merkle.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
