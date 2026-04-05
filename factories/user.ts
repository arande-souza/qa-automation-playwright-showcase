import { faker } from '@faker-js/faker';

export type CreatedUser = {
  firstName: string;
  lastName: string;
  routingNumber: string;
  accountNumber: string;
  username: string;
  password: string;
};

const userRandom = (): CreatedUser => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    firstName,
    lastName,
    routingNumber: faker.finance.routingNumber(),
    accountNumber: faker.finance.accountNumber({ length: 9 }),
    username: `${firstName}${faker.number.int(1000)}`,
    password: 's3cret',
  };
};

export default userRandom;

