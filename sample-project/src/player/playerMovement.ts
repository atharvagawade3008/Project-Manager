import * as THREE from 'three';

export interface PlayerControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
}

export class PlayerMovementController {
  private position: THREE.Vector3;
  private velocity: THREE.Vector3;
  private isGrounded: boolean = true;
  private walkSpeed: number = 5.0;
  private sprintSpeed: number = 10.0;
  private jumpForce: number = 7.5;
  private gravity: number = 18.0;

  constructor(initialPosition: THREE.Vector3 = new THREE.Vector3(0, 1.7, 0)) {
    this.position = initialPosition.clone();
    this.velocity = new THREE.Vector3(0, 0, 0);
  }

  public update(delta: number, input: PlayerControls, cameraYaw: number): THREE.Vector3 {
    const moveSpeed = input.sprint ? this.sprintSpeed : this.walkSpeed;
    const direction = new THREE.Vector3();

    if (input.forward) direction.z -= 1;
    if (input.backward) direction.z += 1;
    if (input.left) direction.x -= 1;
    if (input.right) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      this.velocity.x = direction.x * moveSpeed;
      this.velocity.z = direction.z * moveSpeed;
    } else {
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;
    }

    // Jump and gravity
    if (input.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * delta;
    }

    // Integrate
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;

    // Ground raycast clamp
    if (this.position.y <= 1.7) {
      this.position.y = 1.7;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    return this.position;
  }

  public getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  public getVelocity(): THREE.Vector3 {
    return this.velocity.clone();
  }
}
