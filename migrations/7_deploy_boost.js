const fs = require('fs');
const path = require('path');
const CreatorBoost = artifacts.require("CreatorBoost");

module.exports = async function (deployer) {
    const contractsFile = path.resolve(__dirname, '../contracts-address.json');

    if (!fs.existsSync(contractsFile)) {
    throw new Error("contracts-address.json not found. Deploy NFT contract first.");
    }

    const data = JSON.parse(fs.readFileSync(contractsFile));

    if (!data.FishNFT) {
    throw new Error("FishNFT address not found in contracts-address.json. Deploy NFT contract first.");
    }

    const nftAddress = data.FishNFT;
    console.log("Using FishNFT address:", nftAddress);

    await deployer.deploy(CreatorBoost, nftAddress);
    const creatorBoost = await CreatorBoost.deployed();

    console.log("CreatorBoost deployed at:", creatorBoost.address);

    data.CreatorBoost = creatorBoost.address;
    fs.writeFileSync(contractsFile, JSON.stringify(data, null, 2));
    console.log("Updated contracts-address.json with CreatorBoost address");
};
