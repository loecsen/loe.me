import { inferDomainId } from './infer';

const result = inferDomainId('tennis 7 days');
if (result !== 'fitness_sport') {
  throw new Error(`Expected fitness_sport, got ${result}`);
}
