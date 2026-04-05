import { test, expect } from '@playwright/test'
import { AuthActions } from '../actions/auth.actions'
import userRandom from '../factories/user';

test.describe('Real World App Tests', () => {
  test.describe('Happy Path', () => {
    test('should display the authenticated user name after valid login', async ({ page }) => {
      const auth = new AuthActions(page);

      await auth.visitLogin();
      await auth.assertLoginPage();
      await auth.login('Arvilla_Hegmann', 's3cret');

      const userName = auth.getLoggedUserName();

      await expect(userName).toBeVisible();
      await expect(userName).toContainText('Kristian B');
    });

    test('should create a user account', async ({ page }) => {
      const auth = new AuthActions(page);
      const createdUser = userRandom();

      await auth.visitLogin();
      await auth.createAccount(createdUser);
    });

    test('should create a user and perform a valid login', async ({ page }) => {
      const auth = new AuthActions(page);
      const createdUser = userRandom();

      await auth.visitLogin();
      await auth.createAccount(createdUser);
      await auth.loginPage(createdUser);
      await auth.fillBankDetailsForm(createdUser);
    });

    test('should create and delete the second bank account', async ({ page }) => {
      const auth = new AuthActions(page);
      const createdUser = userRandom();

      await auth.visitLogin();
      await auth.createAccount(createdUser);
      await auth.loginPage(createdUser);
      await auth.fillBankDetailsForm(createdUser);
      await auth.fillBankDetailsFormSecondAccount(createdUser);
      await auth.deleteSecondBankAccount(createdUser);
    });
  });
});
