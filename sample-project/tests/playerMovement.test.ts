import { PlayerMovementController, PlayerControls } from '../player/playerMovement';
import * as THREE from 'three';

export function testPlayerMovement() {
  const player = new PlayerMovementController(new THREE.Vector3(0, 1.7, 0));
  const controls: PlayerControls = {
    forward: true,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
  };

  const nextPos = player.update(0.016, controls, 0);
  if (nextPos.z < 0) {
    console.log('PASS: Player moves forward successfully.');
  } else {
    console.error('FAIL: Player position expected negative Z.');
  }
}
