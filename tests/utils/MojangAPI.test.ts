import { MojangAPI } from '../../src/utils/MojangAPI';

const uuid = '407b28ede7bd451693d93361fecb7889';
const username = 'Sprax2013';

test('Fetching Minecraft profile of Sprax2013', async () => {
  const profile: any = await MojangAPI.getProfile(uuid);

  expect(profile.id).toBe(uuid);
  expect(profile.name).toBe(username);
  expect(profile.legacy).toBeFalsy();
});

test('Fetching unknown Minecraft profile', async () => {
  await expect(MojangAPI.getProfile(uuid + 'a')).resolves.toBeNull();
});
