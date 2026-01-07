const fs = require('fs');
const path = require('path'); 
const RewardClaim = artifacts.require("RewardClaim");
const FishNFT = artifacts.require("FishNFT");

module.exports = async function(deployer, network, accounts) {
  try {
    console.log("\n========================================");
    console.log(" Deploying RewardClaim Contract");
    console.log("========================================\n");

    // Get deployed FishNFT instance
    const fishNFT = await FishNFT.deployed();
    console.log("✓ FishNFT contract found at:", fishNFT.address);

    // Set reward amount (0.01 ETH per NFT)
    const rewardPerNFT = web3.utils.toWei('0.01', 'ether');
    console.log("✓ Reward per NFT set to:", web3.utils.fromWei(rewardPerNFT, 'ether'), "ETH");

    // Deploy RewardClaim contract
    await deployer.deploy(RewardClaim, fishNFT.address, rewardPerNFT);
    const rewardClaim = await RewardClaim.deployed();

    console.log("\nRewardClaim deployed successfully!");
    console.log("Contract Address:", rewardClaim.address);
    console.log("Reward per NFT:", web3.utils.fromWei(rewardPerNFT, 'ether'), "ETH");

    // Fund the contract with initial rewards
    const fundAmount = web3.utils.toWei('1', 'ether');
    console.log("\nFunding contract with:", web3.utils.fromWei(fundAmount, 'ether'), "ETH");
    
    await rewardClaim.depositFunds({ 
      from: accounts[0], 
      value: fundAmount 
    });

    // Verify contract balance
    const balance = await web3.eth.getBalance(rewardClaim.address);
    console.log("Contract balance:", web3.utils.fromWei(balance, 'ether'), "ETH");

    // Get reward stats
    const stats = await rewardClaim.getRewardStats();
    console.log("\n Contract Statistics:");
    console.log("   - Contract Balance:", web3.utils.fromWei(stats[0].toString(), 'ether'), "ETH");
    console.log("   - Total Paid:", web3.utils.fromWei(stats[1].toString(), 'ether'), "ETH");
    console.log("   - Total Claims:", stats[2].toString());
    console.log("   - Reward Amount:", web3.utils.fromWei(stats[3].toString(), 'ether'), "ETH");

    // Calculate how many rewards can be claimed
    const maxClaims = Math.floor(parseFloat(web3.utils.fromWei(balance, 'ether')) / parseFloat(web3.utils.fromWei(rewardPerNFT, 'ether')));
    console.log("\n✨ Maximum claimable rewards:", maxClaims);

    console.log("\n========================================");
    console.log(" Writing to contracts-address.json");
    console.log("========================================");

    // ================================
    // WRITE ADDRESS TO JSON FILE
    // ================================
    const filePath = path.join(__dirname, '../contracts-address.json');

    // Read existing JSON (or create one if not exist)
    let addresses = {};
    if (fs.existsSync(filePath)) {
      addresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    // Update RewardClaim address
    addresses.RewardClaim = rewardClaim.address;

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(addresses, null, 2));

    console.log("✓ RewardClaim address saved to contracts-address.json");
    console.log(" File:", filePath);

    console.log("\n========================================");
    console.log(" Deployment Complete!");
    console.log("========================================");

  } catch (error) {
    console.error("\n Deployment failed:", error.message);
    throw error;
  }
};