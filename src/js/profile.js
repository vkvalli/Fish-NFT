// DOMContentLoaded
window.addEventListener("DOMContentLoaded", async () => {
  const swimBtn = document.getElementById("swimBtn");
  const nftContainer = document.getElementById("nft-container");
  const loadingIndicator = document.getElementById("loadingIndicator");

  swimBtn.style.display = "none";
  swimBtn.disabled = true;

  // Retrieve metadata URL and fish probability from localStorage
  const metadataURL = localStorage.getItem("lastFishMetadata");
  const fishProb = localStorage.getItem("currentFishProbability");
  const initScore = fishProb ? Math.round(parseFloat(fishProb) * 100) : 0;

  // Check if metadata URL exists
  if (!metadataURL) {
    loadingIndicator.style.display = "none";
    nftContainer.innerHTML = "<p>No NFT found. Please mint one first.</p>";
    swimBtn.style.display = "none";
  } else {
    loadingIndicator.style.display = "block";
    const fetchURL = metadataURL.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
    try {
      const meta = await fetch(fetchURL).then(res => res.json());
      loadingIndicator.style.display = "none";
      const imageURL = meta.image.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
      const fishProbText = `Init Score: ${initScore}`;

      nftContainer.innerHTML = `
        <div class="card">
          <div class="img-wrapper">
            <div class="img-loading"></div>
            <img id="fishImage" src="${imageURL}" alt="${meta.name}" style="display:none;">
          </div>
          <h2>${meta.name}</h2>
          <p>${meta.description}</p>
          ${fishProbText ? `<p style="font-weight:bold; color:#218838;">${fishProbText}</p>` : ''}
        </div>
      `;
      swimBtn.style.display = "inline-block";
    } catch (err) {
      loadingIndicator.style.display = "none";
      console.error("Failed to load NFT metadata:", err);
      nftContainer.innerHTML = "<p>Failed to load NFT.</p>";
      swimBtn.style.display = "none";
    }
  }

  const fishImg = document.getElementById("fishImage");
    const imgLoading = document.querySelector(".img-loading");

    fishImg.onload = () => {
    imgLoading.style.display = "none";  // hidden loading
    fishImg.style.display = "block";    // display fish img
    swimBtn.style.display = "inline-block";
    swimBtn.disabled = false;
  };

  // Swim button click event (only for navigation)
  swimBtn.addEventListener("click", () => {
    window.location.href = "index.html"; // Replace "swim.html" with the target page
  });
});
