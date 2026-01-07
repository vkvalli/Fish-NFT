const fs = require('fs');
const path = require('path');

const FishNFT = artifacts.require("FishNFT");
const FishMetadata = artifacts.require("FishMetadata");

module.exports = async function (deployer) {
  // Deploy with the address of the already deployed FishNFT
  await deployer.deploy(FishMetadata, FishNFT.address);
  const metadata = await FishMetadata.deployed();

  console.log("FishMetadata deployed at:", metadata.address);

  // Update contracts-address.json
  const contractsFile = path.resolve(__dirname, '../contracts-address.json');
  let data = {};
  if (fs.existsSync(contractsFile)) {
    try {
      data = JSON.parse(fs.readFileSync(contractsFile));
    } catch (err) {
      console.warn("Could not parse existing contracts-address.json, overwriting.");
      data = {};
    }
  }
  data.FishMetadata = metadata.address;
  fs.writeFileSync(contractsFile, JSON.stringify(data, null, 2));

  console.log("Contract address written to contracts-address.json in project root");
};


