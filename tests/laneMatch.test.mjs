import test from 'node:test';
import assert from 'node:assert/strict';
import { createLaneMatch, LANE } from '../src/simulation/laneMatch.ts';
import { createMovement, STEP } from '../src/simulation/movement.ts';
import { createCombat } from '../src/simulation/combat.ts';
import { canStand, moveWithCollisions } from '../src/simulation/collision.ts';
import { createLaneNavigation } from '../src/simulation/laneNavigation.ts';
import { HERO } from '../src/simulation/config.ts';
const aim = (action, x=0, z=1, distance=6) => ({ action, direction:{x,z}, distance, canceled:false });
const ticks = (m,n,p=LANE.spawn) => { let relocation; for(let i=0;i<n;i++) relocation=m.tick(p) ?? relocation; return relocation; };
const actor = (m,id) => m.actors().find(a=>a.id===id);

test('waves spawn on fixed clock, remain on map and respect per-team cap', () => {
  const m=createLaneMatch(); m.tick(LANE.spawn);
  assert.equal(m.wave(),1); assert.equal(m.actors().filter(a=>a.kind==='minion').length,6);
  ticks(m,899); assert.equal(m.wave(),1); m.tick(LANE.spawn); assert.equal(m.wave(),2);
  for(let i=0;i<60*120;i++) {
    m.tick(LANE.spawn);
    for(const a of m.actors().filter(a=>a.kind==='minion')) assert.ok(canStand(a.position,a.radius));
    for(const team of ['blue','coral']) assert.ok(m.actors().filter(a=>a.team===team&&a.kind==='minion').length<=30);
  }
});

test('navigation goes around foundations instead of becoming stuck on the direct route', () => {
  const next=createLaneNavigation(LANE.minion.radius);
  let p={x:0,z:7}; const goal={x:0,z:15};
  for(let i=0;i<600;i++) {
    const target=next(p,goal), length=Math.hypot(target.x-p.x,target.z-p.z);
    if(length<1e-8) break;
    const scale=Math.min(length,LANE.minion.speed*STEP)/length;
    p=moveWithCollisions(p,{x:(target.x-p.x)*scale,z:(target.z-p.z)*scale},LANE.minion.radius);
    assert.ok(canStand(p,LANE.minion.radius));
  }
  assert.ok(Math.hypot(p.x-goal.x,p.z-goal.z)<0.01);
});

test('tower prioritizes a minion over a closer hero, then attacks unescorted hero', () => {
  const m=createLaneMatch(); m.tick(LANE.spawn);
  const tower=actor(m,'tower-2'), minion=m.actors().find(a=>a.team==='blue'&&a.kind==='minion');
  tower.cooldown=0; minion.position={x:-2.8,z:10};
  const hero={x:0,z:8}; m.tick(hero);
  assert.equal(minion.health,LANE.minion.health-LANE.tower.damage); assert.equal(m.hero.health,HERO.health);
  minion.health=0; tower.cooldown=0; m.tick(hero); assert.equal(m.hero.health,HERO.health-LANE.tower.damage);
});

test('outer tower protects inner tower and base; dead buildings never respawn', () => {
  const m=createLaneMatch(), outer=actor(m,'tower-2'), inner=actor(m,'tower-3'), base=actor(m,'base-1');
  assert.equal(m.vulnerable(outer),true); assert.equal(m.vulnerable(inner),false); assert.equal(m.vulnerable(base),false);
  assert.equal(m.cast({x:-2.8,z:19},aim('attack')),'no-target');
  outer.health=0; assert.equal(m.vulnerable(inner),true); assert.equal(m.vulnerable(base),false);
  inner.health=0; assert.equal(m.vulnerable(base),true);
  ticks(m,180); assert.equal(outer.health,0); assert.equal(inner.health,0);
});

test('Q hits first enemy along segment, E hits multiple enemies and ignores allies', () => {
  const make=(id,z,team='coral')=>({id,team,position:{x:-3,z},health:500,maxHealth:500,radius:0.32,generation:0,respawnIn:0});
  const far=make('far',4), near=make('near',2), ally=make('ally',1,'blue');
  const c=createCombat({targets:()=>[far,near,ally]});
  c.cast({x:-3,z:0},aim('q')); for(let i=0;i<60;i++) c.tick({x:-3,z:0});
  assert.equal(near.health,380); assert.equal(far.health,500); assert.equal(ally.health,500);
  c.cast({x:-3,z:0},aim('e',0,1,3)); for(let i=0;i<60;i++) c.tick({x:-3,z:0});
  assert.equal(near.health,280); assert.equal(far.health,400); assert.equal(ally.health,500);
});

test('death blocks actions and respawn relocates without interpolating through the map', () => {
  const m=createLaneMatch(), movement=createMovement(); movement.reset({x:-3,z:5});
  m.hero.health=0; m.tick(movement.position()); assert.equal(m.hero.respawnIn,8);
  assert.equal(m.cast(movement.position(),aim('q')),'dead');
  assert.deepEqual(m.move(movement.position(),{x:1,z:0}),movement.position());
  for(let i=0;i<479;i++) movement.advance(STEP,{x:0,z:0},m.tick,m.move);
  assert.equal(m.hero.health,0);
  movement.advance(STEP,{x:0,z:0},m.tick,m.move);
  assert.equal(m.hero.health,1000); assert.deepEqual(movement.position(),LANE.spawn); assert.deepEqual(movement.interpolated(),LANE.spawn);
});

test('victory, defeat and draw freeze gameplay; reset restores buildings and clocks', () => {
  for(const result of ['blue','coral','draw']) {
    const m=createLaneMatch(); m.tick(LANE.spawn);
    if(result!=='coral') actor(m,'base-1').health=0;
    if(result!=='blue') actor(m,'base-0').health=0;
    m.tick(LANE.spawn); assert.equal(m.result(),result);
    const before=JSON.stringify(m.actors()), time=m.elapsed(); ticks(m,600);
    assert.equal(JSON.stringify(m.actors()),before); assert.equal(m.elapsed(),time);
    assert.equal(m.cast(LANE.spawn,aim('q')),'invalid'); assert.deepEqual(m.move(LANE.spawn,{x:1,z:0}),LANE.spawn);
    m.reset(); assert.equal(m.result(),undefined); assert.equal(m.wave(),0); assert.equal(m.elapsed(),0);
    assert.equal(m.actors().length,6); assert.ok(m.actors().every(a=>a.health===a.maxHealth));
    assert.equal(m.hero.health,1000); assert.deepEqual(m.combat.projectiles(),[]); assert.deepEqual(m.combat.areas(),[]);
  }
});

test('lane state is identical at 30, 60 and 144 FPS and suspend spends no match time', () => {
  const run=fps=>{
    const m=createLaneMatch(), movement=createMovement(); movement.reset(LANE.spawn);
    for(let i=0;i<fps*20;i++) movement.advance(1/fps,{x:0,z:0},m.tick,m.move);
    const time=m.elapsed(); movement.suspend(); assert.equal(m.elapsed(),time);
    return JSON.stringify({actors:m.actors(),hero:m.hero,wave:m.wave(),time});
  };
  assert.equal(run(30),run(60)); assert.equal(run(60),run(144));
});

test('a full match can be won using normal movement and ability casts, including deaths', () => {
  const m=createLaneMatch(), mv=createMovement(); mv.reset(LANE.spawn);
  let deaths=0, alive=true;
  for(let i=0;i<60*240&&!m.result();i++) {
    const p=mv.position(), t=m.target(1000); let input={x:0,z:0};
    if(t&&m.hero.health>0){
      const dx=t.position.x-p.x,dz=t.position.z-p.z,d=Math.hypot(dx,dz);
      for(const a of ['e','q','attack']) if(d<=(a==='q'?9:a==='e'?6:5)) m.cast(p,aim(a,dx/d,dz/d,d));
      if(d>4.5){const gx=-2.8-p.x,gz=t.position.z-p.z,l=Math.hypot(gx,gz);input={x:gx/l,z:gz/l};}
    }
    mv.advance(STEP,input,m.tick,m.move);
    assert.ok(canStand(mv.position()));
    if(alive&&m.hero.health===0) deaths++; alive=m.hero.health>0;
  }
  assert.equal(m.result(),'blue'); assert.ok(deaths>0);
  assert.equal(actor(m,'tower-2').health,0); assert.equal(actor(m,'tower-3').health,0); assert.equal(actor(m,'base-1').health,0);
});
