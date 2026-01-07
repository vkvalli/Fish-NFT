window.provider = null;
window.signer = null;
window.userAddress = null;
window.contract = null; // NFT contract instance

async function initWalletAndContract() {
    if (!window.ethereum) {
        document.getElementById("walletStatus").innerText = "Please install MetaMask!";
        return;
    }

    // Request Ethereum accounts
    window.provider = new ethers.providers.Web3Provider(window.ethereum);
    await window.provider.send("eth_requestAccounts", []);

    // 🔥 Force Rabby (or any wallet) to switch to Ganache chain (1337)
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x539" }]   // 1337 hex
        });
    } catch (switchError) {
        // If chain is not added, add it
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: "0x539",
                    chainName: "Ganache Local",
                    rpcUrls: ["http://127.0.0.1:7545"],
                    nativeCurrency: {
                        name: "ETH",
                        symbol: "ETH",
                        decimals: 18,
                    },
                }],
            });
        }
    }

    // After chain is guaranteed to be Ganache:
    window.signer = window.provider.getSigner();
    window.userAddress = await window.signer.getAddress();

    const walletSpan = document.getElementById("walletStatus").innerText = "Connected: " + window.userAddress;
    if (walletSpan) {
        walletSpan.innerText = "Connected: " + window.userAddress;
    }

    // listenning account switch
    window.ethereum.on("accountsChanged", async (accounts) => {
        if (accounts.length === 0) {
            window.userAddress = null;
            document.getElementById("walletStatus").innerText = "Wallet disconnected";
        } else {
            window.userAddress = accounts[0];
            document.getElementById("walletStatus").innerText = "Connected: " + window.userAddress;
        }

        window.location.reload();
    });

    // loading contract address
    const addrJson = await fetch('contracts-address.json').then(r => r.json());
    const contractAddress = addrJson.FishNFT;

    // loading ABI
    const res = await fetch('build/contracts/FishNFT.json');
    const json = await res.json();
    const abi = json.abi;

    // Init contract
    window.contract = new ethers.Contract(contractAddress, abi, window.signer);
    // Load Market Contract
    const marketAddress = addrJson.FishMarket;

    const marketRes = await fetch("build/contracts/FishMarket.json");
    const marketJson = await marketRes.json();
    const marketAbi = marketJson.abi;

    window.marketContract = new ethers.Contract(marketAddress, marketAbi, window.signer);

    console.log("Marketplace loaded:", marketAddress);

}

window.addEventListener("load", () => {
    initWalletAndContract();
});

async function loadNav() {
    try {
        const res = await fetch('nav.html');
        const html = await res.text();
        document.getElementById('navbar-container').innerHTML = html;

        // Remove current page link
        const navLinks = document.querySelectorAll("#navbar-container nav a");
        const currentPath = window.location.pathname.split("/").pop();
        
        navLinks.forEach(link => {
            const href = link.getAttribute("href");

            if (href === currentPath) {
                link.remove();
            }

            // if current page is profile.html，remove FinVerse Tank - index.html link
            if (currentPath === "profile.html" && href === "index.html") {
                link.remove();
            }
        });

    } catch (err) {
        console.error("Failed to load navbar:", err);
    }
}

loadNav();
