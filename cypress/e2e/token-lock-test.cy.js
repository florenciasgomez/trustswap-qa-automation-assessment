const ethers = require('ethers');

describe('Token Lock Creation and Verification', () => {
  const contractAddress = "0x4f0fd563be89ec8c3e7d595bf3639128c0a7c33a";
  const tokenAddress = Cypress.env('TOKEN_ADDRESS');
  const network = "ethereum";
  const chainId = "0xaa36a7";
  let lockId;
  let withdrawalAddress;

  before(() => {
    const privateKey = Cypress.env('PRIVATE_KEY');
    if (!privateKey) {
      throw new Error('PRIVATE_KEY is not defined');
    }
    
    const wallet = new ethers.Wallet(privateKey);
    withdrawalAddress = wallet.address;
    cy.log(`Using withdrawal address: ${withdrawalAddress}`);

    // Initialize backend state
    cy.request({
      method: 'GET',
      url: `https://team-finance-backend-dev-origdfl2wq-uc.a.run.app/api/app/mylocks/${withdrawalAddress}`,
      qs: { network, chainId }
    }).then((response) => {
      expect(response.status).to.eq(200);
      cy.log(`Initial locks state retrieved`);
    });
  });

  it('should create a token lock', () => {
    // Create a token lock and verify that a lockId is returned
    cy.task('approveAndLockTokens', { withdrawalAddress, tokenAddress }).then((result) => {
      expect(result).to.have.property('lockId');
      lockId = result.lockId;
      cy.log(`New Lock ID: ${lockId}`);
    });
  });

  it('should resync lock info', () => {
    const maxRetries = 3;
    const retryDelay = 5000;

    function resyncLock(attempt = 1) {
      // Trigger resync on the backend to update lock info
      cy.request({
        method: 'PUT',
        url: `https://team-finance-backend-dev-origdfl2wq-uc.a.run.app/api/app/locks/${contractAddress}/${lockId}`,
        qs: { network, chainId },
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`Resync Response Body: ${JSON.stringify(response.body)}`);

        // Verify the resync is successful
        if (response.status === 200 && response.body.data === true) {
          expect(response.body).to.deep.equal({ data: true });
        } else if (attempt < maxRetries) {
          cy.log(`Resync failed, retrying in ${retryDelay / 1000} seconds... (Attempt ${attempt})`);
          cy.wait(retryDelay);
          resyncLock(attempt + 1);
        } else {
          throw new Error(`Failed to resync after ${maxRetries} attempts. Response: ${JSON.stringify(response.body)}`);
        }
      });
    }

    resyncLock();
  });

  it('should retrieve and validate lock data from backend', () => {
    const maxRetries = 5;
    const retryDelay = 10000;

    function validateLock(attempt = 1) {
      // Retrieve lock data from the backend
      cy.request({
        method: 'GET',
        url: `https://team-finance-backend-dev-origdfl2wq-uc.a.run.app/api/app/mylocks/${withdrawalAddress}`,
        qs: { network, chainId }
      }).then((response) => {
        expect(response.status).to.eq(200);
        const currentLocks = response.body.data;
        cy.log(`Looking for lock ID: ${lockId}`);

        // Validate that the newly created lock exists in the response
        const newLock = currentLocks.find(lock => String(lock.event.lockDepositId) === String(lockId));

        if (newLock) {
          cy.log('New lock found');
          // Validate token address, withdrawal address, and lock amount
          expect(newLock.event.tokenAddress.toLowerCase()).to.equal(tokenAddress.toLowerCase());
          expect(newLock.event.withdrawalAddress.toLowerCase()).to.equal(withdrawalAddress.toLowerCase());
          expect(newLock.event.lockAmount).to.equal('1');
        } else if (attempt < maxRetries) {
          cy.log(`New lock not found, retrying in ${retryDelay / 1000} seconds... (Attempt ${attempt})`);
          cy.wait(retryDelay);
          validateLock(attempt + 1);
        } else {
          throw new Error(`New lock with ID ${lockId} not found after ${maxRetries} attempts.`);
        }
      });
    }

    validateLock();
  });
});
