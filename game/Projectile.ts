import { Vector2 } from '../modules/content-types';

const PROJECTILE_SPEED = 600; // pixels per second
const PROJECTILE_LIFESPAN = 1.5; // seconds
const PROJECTILE_DAMAGE = 25;

export class Projectile {
  public pos: Vector2;
  public vel: Vector2;
  private lifespan: number = PROJECTILE_LIFESPAN;
  public damage: number = PROJECTILE_DAMAGE;

  constructor(startPos: Vector2, angle: number) {
    this.pos = [...startPos];
    this.vel = [
      Math.cos(angle) * PROJECTILE_SPEED,
      Math.sin(angle) * PROJECTILE_SPEED
    ];
  }

  public update(deltaTime: number): void {
    this.pos[0] += this.vel[0] * deltaTime;
    this.pos[1] += this.vel[1] * deltaTime;
    this.lifespan -= deltaTime;
  }

  public isDead(): boolean {
    return this.lifespan <= 0;
  }
}
