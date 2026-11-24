import * as CANNON from 'cannon-es';

export class VehiclePhysicsController {
  private chassisBody: CANNON.Body;
  private currentSteering: number = 0;
  private engineForce: number = 0;

  constructor() {
    this.chassisBody = new CANNON.Body({ mass: 1200 });
  }

  public applyThrottle(force: number) {
    this.engineForce = force;
  }

  public applySteer(angle: number) {
    this.currentSteering = angle;
  }

  public updatePhysics(delta: number) {
    // TODO: Implement vehicle collision response with roadside barriers
    // FIXME: Suspension damping calculation needs tuning for Nerul potholes
    this.chassisBody.applyForce(new CANNON.Vec3(0, 0, this.engineForce));
  }
}
