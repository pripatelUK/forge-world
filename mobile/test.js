// Import the ethers library
const ethers = require('ethers');

// Function to fetch transaction logs
async function fetchTransactionLogs(transactionHash) {
    try {
        // Replace this with your Ethereum provider URL (e.g., Infura, Alchemy)
        const providerUrl = 'YOUR_ETHEREUM_PROVIDER_URL';
        const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");

        // Fetch the transaction receipt
        const receipt = await provider.getTransactionReceipt(transactionHash);

        if (receipt) {
            console.log('Transaction Logs:', receipt.logs);
        } else {
            console.log('Transaction receipt not found');
        }
    } catch (error) {
        console.error('Error fetching transaction logs:', error);
    }
}

// Replace this with the transaction hash you want to fetch logs for
const transactionHash = '0xbb66c92912bede692b10b35b41b190e038136b52ef1da9791d2b3aa50661d7c8';

fetchTransactionLogs(transactionHash);
