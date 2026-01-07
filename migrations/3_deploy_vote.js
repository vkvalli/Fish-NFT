const fs = require('fs');
const path = require('path');
const Vote = artifacts.require("Vote");

module.exports = async function (deployer) {
  await deployer.deploy(Vote);
  const vote = await Vote.deployed();

  console.log("Vote deployed at:", vote.address);

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
  data.Vote = vote.address;
  fs.writeFileSync(contractsFile, JSON.stringify(data, null, 2));

  console.log("Contract address written to contracts-address.json in project root");
};
