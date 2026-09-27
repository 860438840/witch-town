import cloud from 'wx-server-sdk';
import { mathRng } from '../../engine/src/index';
import { handle } from './handler';
import { wxStore } from './wxStore';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const store = wxStore(cloud.database());

export async function main(event: unknown) {
  const { OPENID } = cloud.getWXContext();
  return handle(store, OPENID, event, Date.now(), mathRng);
}
