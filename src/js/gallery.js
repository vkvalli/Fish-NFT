// ----------------- Web3 Variables -----------------
let provider, signer, userAddress;
let fishContract, voteContract, voteReadContract;
let metadataContract, metadataReadContract;
let nftList = []; // for display sort result

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/"
];

// ----------------- IPFS Helper -----------------
function ipfsToGateways(uri) {
  let path = uri.replace(/^ipfs:\/\//, "");
  return IPFS_GATEWAYS.map(g => g + path);
}

async function tryFetch(url, asJSON=false) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    return asJSON ? await res.json() : await res.text();
  } catch { return null; }
}

async function resolveTokenURI(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    for (const t of ipfsToGateways(uri)) {
      if (await tryFetch(t)) return t;
    }
    return null;
  }
  return (await tryFetch(uri)) ? uri : null;
}

// ----------------- Init -----------------
async function init() {
  const addrJson = await fetch("contracts-address.json").then(r => r.json());
  const fishAddr = addrJson.FishNFT;
  const voteAddr = addrJson.Vote;
  const metadataAddr = addrJson.FishMetadata;
  const creatorBoostAddr = addrJson.CreatorBoost;

  const fishABI = [
    "function tokenCounter() view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string memory)"
  ];

  const voteABI = [
    "function count(uint tokenId)",
    "function getVotes(uint tokenId) view returns (uint256)",
    "function getRemainingVotes(uint tokenId) view returns (uint256)"
  ];

  const metadataABI = [
    "function getTrait(uint256 tokenId) view returns (string)",
    "function getMetadata(uint256 tokenId) view returns (string,string,uint256,uint256,uint256,uint256,address)",
    "function incrementLike(uint256 tokenId)",
    // "function incrementReward(uint256 tokenId, uint256 amount)"
  ];

  const creatorBoostABI = [
    "function fishes(uint256 tokenId) view returns (uint256 boostCount, uint256 pendingBoostShare)",
    "function boostFish(uint256 tokenId) external payable",
    "function boostAmount() view returns (uint256)",
    "function claimBoostShare(uint256 tokenId) external",
    "function claimBonus(uint256 tokenId)",
    "function bonusPool() view returns (uint256)"
  ];

  window.creatorBoostContract = new ethers.Contract(creatorBoostAddr, creatorBoostABI, signer);

  const walletEl = document.getElementById("walletAddress") || document.getElementById("walletStatus");

  if (!window.ethereum) {
    if(walletEl) walletEl.innerText = "Please install MetaMask!";
    return;
  }

  try {
    // Init provider
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    if(walletEl) walletEl.innerText = "Connected Wallet: " + userAddress;

    // Init contract
    fishContract = new ethers.Contract(fishAddr, fishABI, signer);
    creatorBoostContract = new ethers.Contract(creatorBoostAddr, creatorBoostABI, signer); 
    voteContract = new ethers.Contract(voteAddr, voteABI, signer);
    voteReadContract = new ethers.Contract(voteAddr, voteABI, provider);
    if (metadataAddr) {
      metadataContract = new ethers.Contract(metadataAddr, metadataABI, signer);
      metadataReadContract = new ethers.Contract(metadataAddr, metadataABI, provider);
    }
    // Listening account change
    window.ethereum.on("accountsChanged", async (accounts) => {
      if (accounts.length > 0) {
        userAddress = accounts[0];
        signer = provider.getSigner();
        if(walletEl) walletEl.innerText = "Connected Wallet: " + userAddress;
        voteContract = new ethers.Contract(voteAddr, voteABI, signer);
        await loadAllNFTs();
      } else {
        if(walletEl) walletEl.innerText = "Please connect a wallet!";
      }
    });

    // loading NFT
    await loadAllNFTs();
    setupSortNav();
    await loadRewardPool();

    setInterval(() => {
      loadRewardPool();
    }, 10000); 

  } catch (err) {
    console.error(err);
    if(walletEl) walletEl.innerText = "Wallet connection failed.";
  }
}

// ----------------- Load NFTs -----------------
async function loadAllNFTs() {
  const gallery = document.getElementById("gallery");
  if(!gallery) return;
  gallery.innerHTML = "Loading all fish...";
  nftList = [];

  try {
    const totalBN = await fishContract.tokenCounter();
    const total = Number(totalBN.toString());
    if (total <= 0) {
      gallery.innerHTML = "No NFTs minted yet.";
      return;
    }

    for (let id = 0; id < total; id++) {
      try {
        const owner = await fishContract.ownerOf(id);
        const tokenURI = await fishContract.tokenURI(id);
        const metaRaw = await fetch(tokenURI).then(r => r.ok ? r.json() : {});
        const imgUrl = await resolveTokenURI(metaRaw.image);

        let createdAt = "Unknown";
        let fishInitScore = 0; // Default initial score
        let creatorBoostCount = 0;
        let fishpendingBoostTips = 0;
        if (creatorBoostContract) {
          const creatorBoostData = await creatorBoostContract.fishes(id);
          creatorBoostCount = Number(creatorBoostData.boostCount.toString());
          fishPendingBoostTips = ethers.utils.formatEther(creatorBoostData.pendingBoostShare.toString());
        }
        if (metaRaw.createdAt) {
          const ts = Number(metaRaw.createdAt);
          createdAt = !isNaN(ts) ? ts * 1000 : Date.parse(metaRaw.createdAt) || "Unknown";
        }

        // Get fishInitScore from Pinata metadata
        if (metaRaw.fishInitScore) {
          fishInitScore = Number(metaRaw.fishInitScore);
        }

        const votesBN = await voteReadContract.getVotes(id);
        const voteCount = Number(votesBN.toString());

        // Read on-chain dynamic metadata if available
        let name = "";
        let trait = "";
        let likes = 0;
        //let rewardCount = 0;
        if (metadataReadContract) {
          try {
            const m = await metadataReadContract.getMetadata(id);
            // (name, trait, likes, createdAt, creator)
            name = m[0] || "";
            trait = m[1] || "";
            likes = Number(m[2]?.toString?.() || m[2] || 0);
            //rewardCount = Number(m[4]?.toString?.() || m[4] || 0);
            const chainCreated = Number(m[5]?.toString?.() || m[5] || 0);
            if (!isNaN(chainCreated) && chainCreated > 0) {
              createdAt = chainCreated * 1000;
            }
          } catch (e) {
            // ignore per-token errors
          }
        }
        // Calculate total score
        const totalScore = fishInitScore + likes;

        nftList.push({ id, imgUrl, owner, tokenURI, voteCount, createdAt, name, trait, likes, fishInitScore, totalScore,creatorBoostCount, fishPendingBoostTips });

      } catch (e) {
        console.warn(`Skipping tokenId ${id} due to error:`, e);
        continue;
      }
    }

    renderGallery();
  } catch (err) {
    gallery.innerHTML = "Error loading gallery: " + err;
  }
}

// ----------------- LOAD MARKETPLACE CONTRACT FOR LISTING BUTTONS  -----------------
async function loadMarketplaceContract() {
  try {
    const addrs = await fetch("contracts-address.json").then(r => r.json());
    window.marketAddress = addrs.FishMarket;

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    const marketABI = [
      "function listItem(address nft, uint256 tokenId, uint256 price)",
      "function buyItem(address nft, uint256 tokenId)",
      "function cancelListing(address nft, uint256 tokenId)",
      "function getListing(address nft, uint256 tokenId) view returns (tuple(address seller,uint256 price,bool active))"
    ];

    window.marketContract = new ethers.Contract(
      window.marketAddress,
      marketABI,
      signer
    );

    console.log("Marketplace loaded in myGallery:", window.marketAddress);
  }
  catch (err) {
    console.error("Failed to load marketplace in gallery:", err);
  }
}
loadMarketplaceContract();

// ----------------- Render Gallery -----------------
function renderGallery(sortBy = getActiveSort()) {
  const gallery = document.getElementById("gallery");
  if(!gallery) return;
  gallery.innerHTML = "";

  let sortedList = [...nftList];
  if (sortBy === "score") {
    sortedList.sort((a, b) => b.totalScore - a.totalScore);} 
  else if (sortBy === "vote") sortedList.sort((a,b)=>b.voteCount-a.voteCount);
  else if(sortBy === "createdAt") sortedList.sort((a,b)=>{
    const aTime = a.createdAt !== "Unknown" ? a.createdAt : 0;
    const bTime = b.createdAt !== "Unknown" ? b.createdAt : 0;
    return bTime - aTime;
  });

  sortedList.forEach((nft)=>{
    const shortOwner = nft.owner ? nft.owner.slice(0,6) + "..." + nft.owner.slice(-4) : "";
    const dateStr = nft.createdAt !== "Unknown" ? new Date(nft.createdAt).toLocaleString() : "Unknown";
    const card = document.createElement("div");
    card.id = `card-${nft.id}`;
    card.className = "card";
    card.innerHTML = `
      <div class="hot-label" id="hot-${nft.id}">🔥 Hot</div>
      <div class="vote-stamp ${nft.voteCount === 0 ? 'no-vote' : 'voted'}" id="vote-stamp-${nft.id}">
        <span class="vote-text">Vote</span>
        <span class="vote-count">${nft.voteCount}</span>
      </div>
      <img src="${nft.imgUrl || ''}" alt="fish-${nft.id}">
      <p><b>Fish #${nft.id}${nft.name ? " - " + nft.name : ""}</b></p>
      <p class="created-time">Created: ${dateStr}</p>
      <p class="created-time">Owner: ${shortOwner}</p>
      <p class="trait-text ${nft.trait ? '' : 'placeholder'}">Trait: ${nft.trait || "N/A"}</p>
      ${metadataContract ? `<p id="like-boost-${nft.id}">⭐ Score: <span id="score-${nft.id}">${nft.totalScore || 0}</span> | ⚡ Boost: <span id="boost-${nft.id}">${nft.creatorBoostCount || 0}</span></p>` : ``}
      <div class="button-row">
        ${metadataContract ? `<button class="like-button" id="like-btn-${nft.id}">Like</button>` : ``}
        <button class="boost-button" id="boost-btn-${nft.id}">Boost</button>
      </div>
    `;

    gallery.appendChild(card);
    updateVoteStamp(nft);

    // click stamp for vote
    const stampEl = document.getElementById(`vote-stamp-${nft.id}`);
    if (stampEl) {
      stampEl.style.cursor = "pointer"; // display clickable
      stampEl.onclick = async () => {
        try {
          const statusEl = document.getElementById("status");
          if (statusEl) statusEl.innerText = `Voting for #${nft.id}...`;

          // Check remaining votes using signer-bound contract (msg.sender-aware)
          const remainingBN = await voteContract.getRemainingVotes(nft.id);
          const remaining = Number(remainingBN?.toString?.() || remainingBN || 0);
          if (remaining <= 0) {
            alert("Vote limit reached"); 
            if (statusEl) statusEl.innerText = "Vote limit reached.";
            return; 
          }

          const tx = await voteContract.count(nft.id);
          await tx.wait();

          const newVotes = await voteReadContract.getVotes(nft.id);
          nft.voteCount = Number(newVotes.toString());
          updateVoteStamp(nft);
          markHotNFTs();

          if (statusEl) statusEl.innerText = "Vote success!";
        } catch (err) {
          // Extract nested revert reason
          const nested =
            err?.data?.data?.reason ||
            err?.data?.reason ||
            err?.error?.data?.reason ||
            err?.reason ||
            err?.message ||
            err?.error?.message ||
            err?.data?.message ||
            String(err);

          const lower = (nested || "").toLowerCase();
          if (lower.includes("vote limit reached")) {
            alert("Vote limit reached");
            const statusEl = document.getElementById("status");
            if (statusEl) statusEl.innerText = "Vote limit reached.";
          } else {
            // Fallback when Ganache strips reason (data = "0x")
            alert("Vote failed: " + (nested || "Transaction reverted without a reason string"));
          }
          console.error(err);
        }
      };
    }

    if (metadataContract) {
      const likeBtn = document.getElementById(`like-btn-${nft.id}`);
      if (likeBtn) {
          if (nft.owner.toLowerCase() === userAddress.toLowerCase()) {
            // hiden btn
            likeBtn.style.display = "none";
          } else {
            likeBtn.disabled = false;
            likeBtn.textContent = "Like";
            likeBtn.onclick = async ()=>{
              try {
                const statusEl = document.getElementById("status");
                if(statusEl) statusEl.innerText = `Liking #${nft.id}...`;
                const tx = await metadataContract.incrementLike(nft.id);
                await tx.wait();
                const m = await metadataReadContract.getMetadata(nft.id);
                nft.likes = Number(m[2]?.toString?.() || m[2] || 0);
                nft.totalScore = nft.fishInitScore + nft.likes; // Update totalScore
                document.getElementById(`score-${nft.id}`).innerText = nft.totalScore;
                markHotNFTs();
                if(statusEl) statusEl.innerText = "Like success!";
              } catch (e) {
                alert("Like failed: " + e);
                console.error(e);
              }
            };
        }        
    }

      const creatorBoostBtn = document.getElementById(`boost-btn-${nft.id}`);
      if (creatorBoostBtn) {
        // if current wallet is NFT owner，disable boost btn
        if (nft.owner.toLowerCase() === userAddress.toLowerCase()) {
            creatorBoostBtn.disabled = true;
            creatorBoostBtn.textContent = "Cannot Like / boost own NFT";
        } else {
            creatorBoostBtn.textContent = "Boost"; 
            creatorBoostBtn.onclick = async () => {
              const creatorBoostAmount = await creatorBoostContract.boostAmount(); 
              if (!confirm(`Clicking will pay ${creatorBoostAmount / 1e18} ETH. Continue?`)) return;

              try {
                const tx = await creatorBoostContract.boostFish(nft.id, { value: creatorBoostAmount });
                alert(`Boost transaction sent! Tx: ${tx.hash}`);
                await tx.wait();
                alert("Boost successfully sent!");

                // update creatorBoostCount
                const creatorBoostData = await creatorBoostContract.fishes(nft.id);
                const updatedcreatorBoostCount = Number(creatorBoostData.boostCount.toString());
                nft.creatorBoostCount = updatedcreatorBoostCount; 
                const boostEl = document.getElementById(`boost-${nft.id}`); 
                if (boostEl) boostEl.innerText = updatedcreatorBoostCount;
                await markHotNFTs();

                await loadRewardPool();
              } catch (err) {
                console.error("Failed to boost fish:", err);
                alert("Failed to boost fish: " + err.message);
              }
            };
        }
      }
    }
  });
  markHotNFTs();
}

async function loadRewardPool() {
  const publicPoolBalanceEl = document.getElementById("public-pool-balance");
  if (!publicPoolBalanceEl) {
    console.error("Element with ID 'public-pool-balance' not found.");
    return;
  }

  if (!window.creatorBoostContract) {
    publicPoolBalanceEl.innerText = "N/A";
    console.error("CreatorBoost contract is not initialized.");
    return;
  }

  try {
    const bonusPool = await window.creatorBoostContract.bonusPool();
    console.log(" Bonus Pool (wei):", bonusPool.toString());
    const bonusPoolEth = ethers.utils.formatEther(bonusPool.toString());
    publicPoolBalanceEl.innerText = `Public Bonus Pool: ${bonusPoolEth} ETH`;
  } catch (err) {
    console.error("Failed to load public bonus pool balance:", err);
    publicPoolBalanceEl.innerText = "Error";
  }
}

function markHotNFTs() {
  const topN = 3;
  //  voteCount > creatorBoostCount > totalScore 
  const sortedNFTs = [...nftList].sort((a, b) => {
  if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
  if (b.creatorBoostCount !== a.creatorBoostCount) return b.creatorBoostCount - a.creatorBoostCount;
    return b.totalScore - a.totalScore;
  });

  sortedNFTs.forEach((nft, idx) => {
  const card = document.getElementById(`card-${nft.id}`);
  if (!card) return;

  let hotLabel = card.querySelector('.hot-label');
  if (!hotLabel) {
    hotLabel = document.createElement('div');
    hotLabel.className = 'hot-label';
    hotLabel.innerText = '🔥 Hot';
    card.prepend(hotLabel);
  }
  hotLabel.style.display = (idx < topN) ? "block" : "none";
  });
}


// ------------------- Voting Icon---------------
function updateVoteStamp(nft) {
  const stamp = document.getElementById(`vote-stamp-${nft.id}`);
  if (!stamp) return;
    stamp.innerHTML = `<span class="vote-text">Vote</span><span class="vote-count">${nft.voteCount}</span>`;

  if (nft.voteCount <= 0) {
    stamp.classList.remove('voted');
    stamp.style.backgroundColor = "#ccc"; 
    stamp.style.boxShadow = "0 0 0 3px #999 inset, 0 2px 5px rgba(0,0,0,0.2)";
    stamp.style.transform = "rotate(-9deg)";
  } else {
    const maxVotes = 20;
    const ratio = Math.min(nft.voteCount / maxVotes, 1);

    const r = 255;
    const g = Math.floor(182 * (1 - ratio)); // 182 → 0
    const b = Math.floor(193 * (1 - ratio)); // 193 → 0

    stamp.style.backgroundColor = `rgb(${r},${g},${b})`;
    stamp.classList.add('voted');
  } 
}

// ----------------- Sorting -----------------
function setupSortNav() {
  const links = document.querySelectorAll("#sort-nav a");
  links.forEach(link=>{
    link.addEventListener("click", e=>{
      e.preventDefault();
      links.forEach(l=>l.classList.remove("active"));
      link.classList.add("active");
      renderGallery(link.dataset.sort);
    });
  });
}

function getActiveSort() {
  const active = document.querySelector("#sort-nav a.active");
  return active?.dataset.sort || "vote";
}


async function listForSale(tokenId) {
  const price = prompt("Enter listing price in ETH:");
  if (!price) return;

  if (!window.marketContract) {
      alert("Marketplace contract not loaded yet.");
      return;
  }

  try {
      const wei = ethers.utils.parseEther(price);

      // APPROVE
      const approveTx = await fishContract.approve(window.marketContract.address, tokenId);
      await approveTx.wait();

      // LIST
      const listTx = await window.marketContract.listItem(
          fishContract.address,
          tokenId,
          wei
      );
      await listTx.wait();

      alert("NFT listed successfully!");
  } catch (err) {
      console.error(err);
      alert("Listing failed: " + err.message);
  }
}

// Attach LIST button events dynamically after rendering
setTimeout(() => {
  document.querySelectorAll(".list-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.id.replace("list-btn-", "");
      listForSale(id);
    });
  });
}, 200);

// ----------------- Load on page -----------------
window.addEventListener("load", init);