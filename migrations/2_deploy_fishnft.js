const fs = require('fs');
const path = require('path');
const FishNFT = artifacts.require("FishNFT");

module.exports = async function (deployer) {
  await deployer.deploy(FishNFT);
  const fishNFT = await FishNFT.deployed();

  console.log("FishNFT deployed at:", fishNFT.address);

  const contractsFile = path.resolve(__dirname, '../contracts-address.json');
  const data = { FishNFT: fishNFT.address };
  fs.writeFileSync(contractsFile, JSON.stringify(data, null, 2));

  console.log("Contract address written to contracts-address.json in project root");
};
