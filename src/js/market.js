// ---------------------------
// Marketplace UI Script
// ---------------------------

// Global variables populated after wallet connection
let provider;
let signer;
let userAddress = null;
let NFT_CONTRACT;
let MARKET_CONTRACT;
window.MARKET_CONTRACT = MARKET_CONTRACT;

// Load contract addresses
async function loadContracts() {
  const res = await fetch("/contracts-address.json");
  const addresses = await res.json();

  // Load ABIs
  const nftABI = (await (await fetch("/build/contracts/FishNFT.json")).json()).abi;
  const marketABI = (await (await fetch("/build/contracts/FishMarket.json")).json()).abi;

  NFT_CONTRACT = new ethers.Contract(addresses.FishNFT, nftABI, signer);
  MARKET_CONTRACT = new ethers.Contract(addresses.FishMarket, marketABI, signer);
}

// Initialize wallet + contracts
async function initWalletAndContracts() {
  try {
    if (!window.ethereum) {
      alert("No Ethereum provider found!");
      return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    console.log("Marketplace initialized. Connected:", userAddress);

    await loadContracts();
    await loadMarketplaceListings();
  } catch (err) {
    console.error("Error initializing marketplace:", err);
  }
}

// ---------------------------
// Load Marketplace Listings
// ---------------------------
// const container = document.getElementById("market-listings");
// if (!container) return;   // ← Prevents errors on pages without listings
// container.innerHTML = "";

function getMarketContainer() {
    return document.getElementById("market-listings");
}


async function loadMarketplaceListings() {
  const statusEl = document.getElementById("market-status");
  const emptyEl = document.getElementById("market-empty");
  const listEl = getMarketContainer();
  if (!listEl) return; // <- allowed because it's INSIDE a function
  listEl.innerHTML = "";


  // listEl.innerHTML = "";
  statusEl.textContent = "Loading marketplace items...";

  try {
    // Get total tokens minted
    const tokenCountBN = await NFT_CONTRACT.tokenCounter();
    const tokenCount = tokenCountBN.toNumber();

    let listingsFound = 0;

    for (let tokenId = 0; tokenId < tokenCount; tokenId++) {
      const listing = await MARKET_CONTRACT.getListing(NFT_CONTRACT.address, tokenId);
      const seller = listing.seller;
      const priceWei = listing.price;
      const active = listing.active;

      if (!active) continue;

      listingsFound++;

      // Fetch metadata
      const tokenURI = await NFT_CONTRACT.tokenURI(tokenId);
      const metadata = await fetch(tokenURI).then(r => r.json());
      const imageUrl = metadata.image || "";
      const name = metadata.name || `Fish #${tokenId}`;
      const priceEth = Number(ethers.utils.formatEther(priceWei));

      // Wrapper div matches gallery.html UI
      const wrapper = document.createElement("div");
      wrapper.className = "market-gallery";

      // Create card
      const card = document.createElement("article");
      card.className = "market-card";
      card.innerHTML = `
        <div class="market-left">
          <img src="${imageUrl}" alt="NFT image" class="fish-image">

          <div class="market-info-left">
            <p>Fish ${name}</p>
            <p class="small-info">Token ID: ${tokenId}</p>
            <p class="small-info">Seller: ${seller.slice(0,6)}...${seller.slice(-4)}</p>
          </div>
        </div>

        <div class="market-info-right">
          <div class="price-column">
            <p class="price">${priceEth} ETH</p>
          </div>
          <div class="button-column">
            <button class="buy-button" data-tokenid="${tokenId}">Buy</button>
            <button class="sell-btn" data-token="${tokenId}" style="display:none;">Sell</button>
            <button class="cancel-button" data-tokenid="${tokenId}" style="display:none;">Cancel Listing</button>
            <button class="update-price-btn" data-tokenid="${tokenId}" style="display:none;">Update Price</button>
          </div>
        </div>
     `;

     // Attach card → wrapper → page
      wrapper.appendChild(card);
      listEl.appendChild(wrapper);


      // Get buttons
      const buyBtn = card.querySelector(".buy-button");
      const sellBtn = card.querySelector(".sell-btn")
      const cancelBtn = card.querySelector(".cancel-button");
      const updateBtn = card.querySelector(".update-price-btn");

      // Determine if current user is the seller
      const isSeller =
        userAddress &&
        seller &&
        userAddress.toLowerCase() === seller.toLowerCase();

      // BUYER (someone else)
      if (!isSeller) {
        buyBtn.style.display = "block";
        sellBtn.style.display = "none";
        cancelBtn.style.display = "none";

        buyBtn.addEventListener("click", () => buyNFT(tokenId, priceEth));

      // SELLER
      } else {
        buyBtn.style.display = "none";

        if (active) {
          // Already listed → show Cancel
          cancelBtn.style.display = "block";
          sellBtn.style.display = "none";
          updateBtn.style.display = "block";

          cancelBtn.addEventListener("click", () => cancelListing(tokenId));
          updateBtn.addEventListener("click", () => updatePrice(tokenId));
        } else {
          // Not listed yet → show Sell
          sellBtn.style.display = "block";
          cancelBtn.style.display = "none";
          updateBtn.style.display = "none";

          sellBtn.addEventListener("click", () => openSellModal(tokenId));
        }
      }
    }

    statusEl.textContent = "Marketplace loaded.";

    if (listingsFound === 0) {
      emptyEl.style.display = "block";
    } else {
      emptyEl.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading marketplace listings:", error);
    statusEl.textContent = "Error loading listings.";
  }
}

async function listForSale(tokenId, eth) {
  try {
    const wei = ethers.utils.parseEther(eth.toString());

    // IMPORTANT: approve NFT transfer first
    const approval = await NFT_CONTRACT.approve(MARKET_CONTRACT.address, tokenId);
    await approval.wait();

    const tx = await MARKET_CONTRACT.listItem(
      NFT_CONTRACT.address,
      tokenId,
      wei
    );
    await tx.wait();

    alert(`Fish #${tokenId} listed for ${eth} ETH!`);
    loadMarketplaceListings();

  } catch (err) {
    console.error("Sell failed:", err);
    alert("Sell failed.");
  }
}


// ---------------------------
// BUY NFT
// ---------------------------
async function buyNFT(tokenId, priceEth) {
  try {
    const tx = await MARKET_CONTRACT.buyItem(
      NFT_CONTRACT.address,
      tokenId,
      {
        value: ethers.utils.parseEther(priceEth.toString()),
      }
    );

    await tx.wait();
    alert("Purchase complete!");
    await loadMarketplaceListings();
  } catch (err) {
    console.error("Buy failed:", err);
    alert("Purchase failed.");
  }
}

// ---------------------------
// CANCEL LISTING
// ---------------------------
async function cancelListing(tokenId) {
  try {
    const tx = await MARKET_CONTRACT.cancelListing(NFT_CONTRACT.address, tokenId);
    await tx.wait();

    alert("Listing canceled!");
    await loadMarketplaceListings();
  } catch (err) {
    console.error("Cancel failed:", err);
    alert("Cancel failed.");
  }
}
function openSellModal(tokenId) {
  const eth = prompt("Enter sale price in ETH:");
  if (!eth) return;

  listForSale(tokenId, eth);
}

// ---------------------------
// UPDATE PRICE
// ---------------------------

async function updatePrice(tokenId) {
    const newPrice = prompt("Enter NEW price in ETH:");
    if (!newPrice) return;

    try {
        const wei = ethers.utils.parseEther(newPrice.toString());

        const tx = await MARKET_CONTRACT.updatePrice(
            NFT_CONTRACT.address,
            tokenId,
            wei
        );

        await tx.wait();
        alert(`Listing updated to ${newPrice} ETH.`);
        loadMarketplaceListings();

    } catch (err) {
        console.error("Update price failed:", err);
        alert("Update price failed.");
    }
}

// Start Marketplace
window.addEventListener("load", () => {
  initWalletAndContracts();
});
