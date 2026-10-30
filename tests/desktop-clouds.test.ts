import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudLayout, cloudPosition, cloudImmersion } from '../src/cloud-layout';
import { FLIGHT_MAX_HEIGHT } from '../src/movement';
import { KEY_ACTIONS } from '../src/input';
const bounds = {minX:-160,maxX:160,minZ:-20,maxZ:603};
test('cloud layout is stable, bounded and reachable without changing flight height', () => {
  const a = cloudLayout('mushroom-grove', bounds, () => 0);
  assert.deepEqual(a, cloudLayout('mushroom-grove', bounds, () => 0));
  assert(a.length > 20 && a.length <= 96);
  for (const c of a) { assert(c.y + .35 < FLIGHT_MAX_HEIGHT); assert(c.y - c.radius * .5 > 3); }
  assert.notDeepEqual(a, cloudLayout('another-region', bounds, () => 0));
  assert.deepEqual(cloudLayout('mushroom-home', bounds, () => 0, true), []);
  assert.deepEqual(cloudLayout('too-high', bounds, () => FLIGHT_MAX_HEIGHT), []);
});
test('cloud drift and immersion are continuous and derived from shared time', () => {
  const c = cloudLayout('village', bounds, () => 0)[0];
  for (const time of [0, 150, 720, 100000]) {
    const a = cloudPosition(c, time), b = cloudPosition(c, time + .016);
    assert.deepEqual(a, cloudPosition(c, time));
    assert(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .002);
    assert(Math.abs(a.x - c.x) <= 3.2 && Math.abs(a.z - c.z) <= 2.1);
    assert.equal(cloudImmersion(c, time, a), 1);
    assert.equal(cloudImmersion(c, time, {...a, y:a.y - 15}), 0);
  }
});
test('desktop shortcuts retain all legacy combat and movement action identities', () => {
  assert.equal(KEY_ACTIONS.Digit1, KEY_ACTIONS.KeyK); assert.equal(KEY_ACTIONS.Digit2, KEY_ACTIONS.KeyL);
  assert.equal(KEY_ACTIONS.KeyJ,'attack'); assert.equal(KEY_ACTIONS.Space,'jump');
  assert.equal(KEY_ACTIONS.KeyQ,'dodge'); assert.equal(KEY_ACTIONS.KeyB,'mount');
  assert.equal(KEY_ACTIONS.KeyE,'interact'); assert.equal(KEY_ACTIONS.KeyF,'ping');
  assert.equal(KEY_ACTIONS.KeyM,undefined); assert.equal(KEY_ACTIONS.KeyI,undefined);
});
