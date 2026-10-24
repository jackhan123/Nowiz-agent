import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraph, makeNode, connectNodes, evaluateGraph, renderNodeTexture } from '../public/studio/node-graph.js';
import { applyDesignChanges } from '../public/studio/api-contract.js';
const clone=v=>JSON.parse(JSON.stringify(v));
const base={primary:'#c8102e',base:'#f5f1e8',pattern:'flow',density:40,scale:100,rotation:0,zone:'all',regions:{upper:null,lower:null}};

test('a connected graph produces the specified shape, repetition and palette',()=>{
  const g=createGraph();g.nodes.find(n=>n.type==='palette').data.primary='#315f87';
  const result=evaluateGraph(g);assert.equal(result.connected,5);assert.equal(result.layers[0].shape,'leaf');assert.equal(result.layers[0].count,6);assert.equal(result.layers[0].primary,'#315f87');
});
test('disconnected nodes do not affect output and missing required connections block output',()=>{
  const g=createGraph();g.nodes.push(makeNode('motif','unused'));assert.equal(evaluateGraph(g).connected,5);
  g.edges.pop();assert.throws(()=>evaluateGraph(g),/请连接/);
});
test('reconnecting a port replaces its previous source and rejects cycles',()=>{
  let g=createGraph();g.nodes.push(makeNode('motif','triangle'));g.nodes.at(-1).data.shape='triangle';g=connectNodes(g,'triangle','repeat',0);
  assert.equal(g.edges.filter(e=>e.to==='repeat').length,1);assert.equal(evaluateGraph(g).layers[0].shape,'triangle');
  assert.throws(()=>connectNodes(g,'palette','repeat',0),/循环/);
  const broken=createGraph();broken.edges.push({from:'palette',to:'repeat',input:0});assert.throws(()=>evaluateGraph(broken));
});
test('two connected branches create two layers with controlled opacity',()=>{
  let g=createGraph();g.nodes.push(makeNode('motif','star'),makeNode('mix','mix'));g.nodes.at(-2).data.shape='star';
  g=connectNodes(g,'palette','mix',0);g=connectNodes(g,'star','mix',1);g=connectNodes(g,'mix','output',0);
  const result=evaluateGraph(g);assert.equal(result.layers.length,2);assert.equal(result.layers[1].shape,'star');assert.equal(result.layers[1].opacity,.65);
});
test('renderer uses graph geometry and layout to draw actual texture content',()=>{
  let arcs=0,curves=0;const ctx=new Proxy({arc(){arcs++;},bezierCurveTo(){curves++;}}, {get(t,key){if(key in t)return t[key];return ()=>{};},set(t,key,v){t[key]=v;return true;}});
  renderNodeTexture(ctx,createGraph('geo'),384);assert.ok(arcs>0);assert.equal(curves,0);
  arcs=0;renderNodeTexture(ctx,createGraph('leaf'),384);assert.equal(arcs,0);assert.ok(curves>0);
});
test('regional node artwork survives unrelated global adjustments and serialization',()=>{
  const d=clone(base);d.regions.upper={...base,pattern:'botanical',nodeGraph:createGraph()};
  const result=applyDesignChanges(d,{density:50});assert.ok(result.regions.upper.nodeGraph);assert.equal(result.regions.upper.pattern,'botanical');assert.equal(result.regions.upper.nodeGraph.nodes.find(n=>n.type==='repeat').data.count,8);
  assert.equal(d.regions.upper.nodeGraph.nodes.find(n=>n.type==='repeat').data.count,6);assert.equal(evaluateGraph(JSON.parse(JSON.stringify(result)).regions.upper.nodeGraph).connected,5);
});
test('color edits update node palettes; explicitly choosing a preset exits node artwork',()=>{
  const d={...clone(base),nodeGraph:createGraph()};const blue=applyDesignChanges(d,{primary:'#315f87'});assert.equal(evaluateGraph(blue.nodeGraph).layers[0].primary,'#315f87');
  const preset=applyDesignChanges(blue,{pattern:'geometric'});assert.equal(preset.nodeGraph,undefined);assert.equal(preset.pattern,'geometric');
});
test('graph rejects invalid identities and excessive graph sizes',()=>{
  const g=createGraph();g.nodes[0].id='bad\"selector';assert.throws(()=>evaluateGraph(g),/节点标识/);
  const large=createGraph();for(let i=0;i<25;i++)large.nodes.push(makeNode('motif','extra'+i));assert.throws(()=>evaluateGraph(large),/24/);
});
