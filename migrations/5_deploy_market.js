// const fs = require("fs");
// const path = require("path");
// const FishMarket = artifacts.require("FishMarket");

// module.exports = async function (deployer) {
//   const feeBps = 250;
//   await deployer.deploy(FishMarket, feeBps);
//   const market = await FishMarket.deployed();

//   // Auto-write logic:
//   const filePath = path.join(__dirname, "../contracts-address.json");
//   let addrJson = {};

//   if (fs.existsSync(filePath)) {
//     addrJson = JSON.parse(fs.readFileSync(filePath));
//   }

//   addrJson["FishMarket"] = market.address;

//   fs.writeFileSync(filePath, JSON.stringify(addrJson, null, 2), "utf-8");

//   console.log("FishMarket deployed at:", market.address);
//   console.log("Contract address written to contracts-address.json in project root");
// };

const fs = require("fs");
const path = require("path");
const FishMarket = artifacts.require("FishMarket");

module.exports = async function (deployer) {
  const feeBps = 250;  // 2.5% marketplace fee
  await deployer.deploy(FishMarket, feeBps);
  const market = await FishMarket.deployed();

  const filePath = path.join(__dirname, "../contracts-address.json");
  let addrJson = {};

  if (fs.existsSync(filePath)) {
    addrJson = JSON.parse(fs.readFileSync(filePath));
  }

  addrJson["FishMarket"] = market.address;

  fs.writeFileSync(filePath, JSON.stringify(addrJson, null, 2), "utf-8");

  console.log("FishMarket deployed at:", market.address);
  console.log("Contract address written to contracts-address.json in project root");
};
