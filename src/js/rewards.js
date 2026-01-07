// rewards.js - Reward Claim functionality for FinVerse (ethers v5)
let rewardProvider, rewardSigner, rewardContract, fishContract;
let rewardUserAddress, rewardContractAddress, fishContractAddress;
let claimableTokens = [];
let userOwnedTokens = [];

const rewardContractABI = [
  "function rewardPerNFT() public view returns (uint256)",
  "function hasClaimed(uint256 tokenId) public view returns (bool)",
  "function totalClaimed(address user) public view returns (uint256)",
  "function claimReward(uint256 tokenId) public",
  "function claimMultipleRewards(uint256[] calldata tokenIds) public",
  "function isClaimable(uint256 tokenId, address user) public view returns (bool)",
  "function getClaimStatuses(uint256[] calldata tokenIds) public view returns (bool[] memory)",
  "function getContractBalance() public view returns (uint256)",
  "function getRewardStats() public view returns (uint256, uint256, uint256, uint256)",
  "event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 amount, uint256 timestamp)"
];

const fishNFTABI = [
  "function tokenCounter() public view returns (uint256)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function tokenURI(uint256 tokenId) public view returns (string memory)"
];

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/"
];

function ipfsToGateways(ipfsUri) {
  if (!ipfsUri) return [];
  let path = ipfsUri.replace(/^ipfs:\/\//, "").replace(/^ipfs\/?/, "");
  return IPFS_GATEWAYS.map(g => g + path);
}

async function tryFetch(url, asJSON = false) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return asJSON ? await res.json() : await res.text();
  } catch {
    return null;
  }
}

async function resolveTokenURI(uri) {
  const candidates = uri.startsWith("ipfs://") ? ipfsToGateways(uri) : [uri];
  for (const c of candidates) {
    const json = await tryFetch(c, true).catch(() => null);
    if (json && typeof json === "object") {
      const image = json.image || json.image_url || json.imageURI;
      if (image) {
        if (image.startsWith("ipfs://")) {
          const gws = ipfsToGateways(image);
          for (const gw of gws) {
            const ok = await tryFetch(gw, false);
            if (ok !== null) return gw;
          }
        } else return image;
      }
    }
  }
  for (const c of candidates) {
    const ok = await tryFetch(c, false);
    if (ok !== null) return c;
  }
  return null;
}

async function initRewards() {
  try {
    // Load contract addresses
    const addrJson = await fetch('contracts-address.json').then(r => r.json());
    rewardContractAddress = addrJson.RewardClaim;
    fishContractAddress = addrJson.FishNFT;

    if (!rewardContractAddress) {
      showError("RewardClaim contract not found. Please deploy the contract first.");
      document.getElementById("walletAddress").innerText = "Contract not deployed";
      return;
    }

    // Check for MetaMask
    if (!window.ethereum) {
      showError("Please install MetaMask to use this feature!");
      document.getElementById("walletAddress").innerText = "Please install MetaMask";
      return;
    }

    // Initialize provider and signer (ethers v5)
    rewardProvider = new ethers.providers.Web3Provider(window.ethereum);
    await rewardProvider.send("eth_requestAccounts", []);
    rewardSigner = rewardProvider.getSigner();
    rewardUserAddress = await rewardSigner.getAddress();

    // Update wallet display
    document.getElementById("walletAddress").innerText = `Connected: ${rewardUserAddress.slice(0, 6)}...${rewardUserAddress.slice(-4)}`;

    // Initialize contracts
    rewardContract = new ethers.Contract(rewardContractAddress, rewardContractABI, rewardSigner);
    fishContract = new ethers.Contract(fishContractAddress, fishNFTABI, rewardProvider);

    // Listen for account changes
    window.ethereum.on("accountsChanged", async (accounts) => {
      if (accounts.length === 0) {
        showError("Wallet disconnected");
        rewardUserAddress = null;
        document.getElementById("walletAddress").innerText = "Wallet disconnected";
      } else {
        location.reload();
      }
    });

    // Load data
    await loadRewardData();
    setupEventListeners();

  } catch (error) {
    console.error("Initialization error:", error);
    showError("Failed to initialize: " + error.message);
    document.getElementById("walletAddress").innerText = "Initialization failed";
  }
}

async function loadRewardData() {
  try {
    showLoading(true);

    // Get reward statistics
    const stats = await rewardContract.getRewardStats();
    const contractBalance = ethers.utils.formatEther(stats[0]);
    const totalPaid = ethers.utils.formatEther(stats[1]);
    const totalClaims = stats[2].toString();
    const rewardAmount = ethers.utils.formatEther(stats[3]);

    // Update stats display
    document.getElementById("rewardPerNFT").innerText = `${rewardAmount} ETH`;
    document.getElementById("contractBalance").innerText = `${parseFloat(contractBalance).toFixed(4)} ETH`;
    document.getElementById("totalPaid").innerText = `${parseFloat(totalPaid).toFixed(4)} ETH`;
    document.getElementById("totalClaims").innerText = totalClaims;

    // Get user's total claimed
    const userClaimed = await rewardContract.totalClaimed(rewardUserAddress);
    document.getElementById("userTotalClaimed").innerText = `${ethers.utils.formatEther(userClaimed)} ETH`;

    // Get all user's NFTs
    await loadUserNFTs();

    showLoading(false);

  } catch (error) {
    console.error("Error loading reward data:", error);
    showError("Failed to load reward data: " + error.message);
    showLoading(false);
  }
}

async function loadUserNFTs() {
  try {
    const total = await fishContract.tokenCounter();
    const totalNum = total.toNumber();

    userOwnedTokens = [];
    claimableTokens = [];

    // Get all tokens owned by user
    for (let i = 0; i < totalNum; i++) {
      try {
        const owner = await fishContract.ownerOf(i);
        if (owner.toLowerCase() === rewardUserAddress.toLowerCase()) {
          userOwnedTokens.push(i);

          // Check if claimable
          const claimed = await rewardContract.hasClaimed(i);
          if (!claimed) {
            claimableTokens.push(i);
          }
        }
      } catch (e) {
        // Token might not exist or be burned
        console.warn(`Token ${i} error:`, e.message);
      }
    }

    // Update UI
    document.getElementById("ownedCount").innerText = userOwnedTokens.length;
    document.getElementById("claimableCount").innerText = claimableTokens.length;

    // Display NFT cards
    await displayNFTCards();

  } catch (error) {
    console.error("Error loading user NFTs:", error);
    showError("Failed to load your NFTs: " + error.message);
  }
}

async function displayNFTCards() {
  const container = document.getElementById("nftCardsContainer");
  container.innerHTML = "";

  if (userOwnedTokens.length === 0) {
    container.innerHTML = `
      <div class="no-nfts">
        <p>You don't own any Fish NFTs yet!</p>
        <a href="draw.html" class="btn-primary">Create Your First Fish</a>
      </div>
    `;
    updateClaimAllButton();
    return;
  }

  // Get claim statuses for all user tokens
  const claimStatuses = await rewardContract.getClaimStatuses(userOwnedTokens);

  for (let i = 0; i < userOwnedTokens.length; i++) {
    const tokenId = userOwnedTokens[i];
    const hasClaimed = claimStatuses[i];

    const card = document.createElement("div");
    card.className = `nft-card ${hasClaimed ? 'claimed' : 'claimable'}`;
    card.dataset.tokenId = tokenId;

    // Get token URI for image
    let imageUrl = "src/img/finverse.png"; // Default fallback
    try {
      const tokenURI = await fishContract.tokenURI(tokenId);
      if (tokenURI.startsWith("data:application/json;base64,")) {
        const base64Data = tokenURI.split(",")[1];
        const metadata = JSON.parse(atob(base64Data));
        imageUrl = metadata.image || imageUrl;

        // Handle IPFS images
        if (imageUrl.startsWith("ipfs://")) {
          const gateways = ipfsToGateways(imageUrl);
          imageUrl = gateways[0]; // Use first gateway
        }
      } else {
        // Try to resolve the URI
        const resolved = await resolveTokenURI(tokenURI);
        if (resolved) imageUrl = resolved;
      }
    } catch (e) {
      console.warn(`Failed to load image for token ${tokenId}:`, e);
    }

    card.innerHTML = `
      <div class="nft-image">
        <img src="${imageUrl}" alt="Fish #${tokenId}" onerror="this.src='src/img/finverse.png'">
        ${hasClaimed ? '<div class="claimed-badge">✓</div>' : '<div class="claimable-badge">Claim</div>'}
      </div>
      <div class="nft-info">
        <h3>Fish #${tokenId}</h3>
        ${hasClaimed
        ? '<button class="btn-disabled" disabled>Already Claimed</button>'
        : `<button class="btn-claim" onclick="claimSingleReward(${tokenId})">Claim Reward</button>`
      }
      </div>
    `;

    container.appendChild(card);
  }

  // Update claim all button
  updateClaimAllButton();
}

function updateClaimAllButton() {
  const claimAllBtn = document.getElementById("claimAllBtn");

  if (claimableTokens.length === 0) {
    claimAllBtn.disabled = true;
    claimAllBtn.innerText = "No Rewards to Claim";
    claimAllBtn.classList.add("btn-disabled");
    claimAllBtn.classList.remove("btn-primary");
  } else {
    claimAllBtn.disabled = false;
    claimAllBtn.innerText = `Claim All (${claimableTokens.length}) Rewards`;
    claimAllBtn.classList.remove("btn-disabled");
    claimAllBtn.classList.add("btn-primary");
  }
}

async function claimSingleReward(tokenId) {
  try {
    showLoading(true);

    const tx = await rewardContract.claimReward(tokenId);
    showSuccess(`Transaction submitted! Claiming reward for Fish #${tokenId}...`);

    await tx.wait();
    showSuccess(`Successfully claimed reward for Fish #${tokenId}! 🎉`);

    // Reload data
    await loadRewardData();

  } catch (error) {
    console.error("Claim error:", error);
    if (error.code === 4001) {
      showError("Transaction rejected by user");
    } else {
      showError("Failed to claim reward: " + (error.reason || error.message));
    }
  } finally {
    showLoading(false);
  }
}

async function claimAllRewards() {
  if (claimableTokens.length === 0) {
    showError("No rewards available to claim");
    return;
  }

  try {
    showLoading(true);

    const tx = await rewardContract.claimMultipleRewards(claimableTokens);
    showSuccess(`Transaction submitted! Claiming ${claimableTokens.length} rewards...`);

    await tx.wait();
    showSuccess(`Successfully claimed all rewards! 🎉💰`);

    // Reload data
    await loadRewardData();

  } catch (error) {
    console.error("Claim all error:", error);
    if (error.code === 4001) {
      showError("Transaction rejected by user");
    } else {
      showError("Failed to claim rewards: " + (error.reason || error.message));
    }
  } finally {
    showLoading(false);
  }
}

function setupEventListeners() {
  document.getElementById("claimAllBtn").addEventListener("click", claimAllRewards);
  document.getElementById("refreshBtn").addEventListener("click", loadRewardData);
}

// Utility functions
function showLoading(show) {
  const loader = document.getElementById("loadingOverlay");
  if (loader) {
    loader.style.display = show ? "flex" : "none";
  }
}

function showSuccess(message) {
  showNotification(message, "success");
}

function showError(message) {
  showNotification(message, "error");
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerText = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
  }, 10);

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Make functions globally available for onclick handlers
window.claimSingleReward = claimSingleReward;

// Initialize on page load
window.addEventListener("load", initRewards);