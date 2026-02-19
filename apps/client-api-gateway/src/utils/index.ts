import { v4 as uuidv4, validate } from 'uuid';

export const generateRandomUUID = (): string => {
  return uuidv4();
};

export const isUUID = (input: string) => {
  return validate(input);
};
