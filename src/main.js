const ethers = require("ethers");
require('dotenv').config();

const sepoliaRpcUrl = "https://rpc2.sepolia.org";
const privateKey = process.env.PRIVATE_KEY || "PRIVATE KEY GOES HERE";

const erc20Abi = [
    "function approve(address spender, uint256 amount) public returns (bool)"
];

const lockAbi = [
    "function lockToken(address _tokenAddress, address _withdrawalAddress, uint256 _amount, uint256 _unlockTime, bool _mintNFT, address referrer) payable returns (uint256 _id)",
    "event Deposit(uint256 id, address indexed tokenAddress, address indexed withdrawalAddress, uint256 amount, uint256 unlockTime)"
];

const contractAddress = "0x4f0fd563be89ec8c3e7d595bf3639128c0a7c33a";
const tokenAddress = "0xE32db794F27c1E3Aa7498f78d73Dc2d265F6893a";

const amountToLock = 1;
const unlockTime = Math.floor(Date.now() / 1000) + (3600 * 24);
const mintNFT = false;
const referrer = "0x0000000000000000000000000000000000000000";

const provider = new ethers.JsonRpcProvider(sepoliaRpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);
const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
const lockingContract = new ethers.Contract(contractAddress, lockAbi, wallet);

async function approveAndLockTokens(withdrawalAddress) {
    try {
        console.log("Approving contract to spend tokens...");
        const approveTx = await tokenContract.approve(contractAddress, amountToLock);
        console.log("Approval transaction sent, waiting for confirmation...");

        await approveTx.wait();
        console.log("Approval confirmed!");

        const lockTx = await lockingContract.lockToken(
            tokenAddress,
            withdrawalAddress,
            amountToLock,
            unlockTime,
            mintNFT,
            referrer,
            {
                gasLimit: 300000
            }
        );

        const receipt = await lockTx.wait();
        console.log("Lock transaction confirmed! Receipt:", receipt);

        let lockId = null;
        console.log("Emitted events:");
        receipt.logs.forEach(log => {
            try {
                const parsedLog = lockingContract.interface.parseLog(log);
                if (parsedLog.name === 'Deposit') {
                    lockId = parsedLog.args.id;
                    console.log(`Lock ID: ${lockId.toString()}`);
                }
            } catch (error) {
                console.log("Non-related log:", log);
            }
        });
        if (lockId !== null) {
            return lockId;
        } else {
            console.log("No Deposit event found.");
        }
    } catch (error) {
        console.error("Error approving or locking tokens:", error);
    }
}

module.exports = { approveAndLockTokens };