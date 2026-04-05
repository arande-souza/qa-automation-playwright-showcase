import { Page, expect } from '@playwright/test'
import type { CreatedUser } from '../factories/user';



export class AuthActions {
  constructor(private page: Page) { }

  async visitLogin() {
    await this.page.goto('/signin')
  }

  async assertLoginPage() {
    await expect(
      this.page.getByRole('heading', { name: /sign in/i })
    ).toBeVisible()

    await expect(
      this.page.getByRole('button', { name: /sign in/i })
    ).toBeVisible()
  }

  async login(username: string, password: string) {
    await this.page.locator('[data-test="signin-username"] input').fill(username)
    await this.page.locator('[data-test="signin-password"] input').fill(password)
    await this.page.getByRole('button', { name: /sign in/i }).click()
  }

  getLoggedUserName() {
    return this.page.locator('[data-test="sidenav-user-full-name"]')
  }

  async createAccount(user: CreatedUser) {
    await this.page.locator('[data-test="signup"]').click();

    await this.page.locator('input[name="firstName"]').fill(user.firstName);
    await this.page.locator('input[name="lastName"]').fill(user.lastName);
    await this.page.locator('input[name="username"]').fill(user.username);
    await this.page.locator('input[name="password"]').fill(user.password);
    await this.page.locator('input[name="confirmPassword"]').fill(user.password);
    await this.page.locator('[data-test="signup-submit"]').click();
  }

  async loginPage(user: CreatedUser) {
    await this.page.locator('[data-test="signin-username"] input').fill(user.username);
    await this.page.locator('[data-test="signin-password"] input').fill(user.password);
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  async fillBankDetailsForm(user: CreatedUser) {
    await this.page.locator('[data-test="user-onboarding-next"]').click();
    await this.page.locator('[name="bankName"]').fill(`${user.firstName} ${user.lastName}`);
    await this.page.locator('[name="routingNumber"]').fill(user.routingNumber);
    await this.page.locator('[name="accountNumber"]').fill(user.accountNumber);
    await this.page.locator('[data-test="bankaccount-submit"]').click();
    await this.page.locator('[data-test="user-onboarding-next"]').click();
    await this.page.locator('[data-test="sidenav-bankaccounts"]').click();
  }

  async fillBankDetailsFormSecondAccount(user: CreatedUser) {
    await this.page.locator('[data-test="bankaccount-new"]').click();
    await this.page.locator('[name="bankName"]').fill(`${user.firstName} ${user.lastName} 2`);
    await this.page.locator('[name="routingNumber"]').fill(user.routingNumber);
    await this.page.locator('[name="accountNumber"]').fill(`${user.accountNumber}2`);
    await this.page.locator('[data-test="bankaccount-submit"]').click();
  }

  async deleteSecondBankAccount(createdUser: CreatedUser) {
    const secondBankName = `${createdUser.firstName} ${createdUser.lastName} 2`;

    const secondBankAccountItem = this.page
      .locator('[data-test^="bankaccount-list-item-"]')
      .filter({ hasText: secondBankName })
      .first();

    await expect(secondBankAccountItem).toBeVisible();
    await secondBankAccountItem.locator('[data-test="bankaccount-delete"]').click();
    await expect(secondBankAccountItem).toContainText('Deleted');
  }


}
