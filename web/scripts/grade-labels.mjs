#!/usr/bin/env node
/* global console, process */
// Grade students' labels files (from "Download my labels") against the AI4Mars reference inside each file.
// Usage: node scripts/grade-labels.mjs labels-*.json
import { readFileSync } from 'node:fs'

const CLASSES = 4 // soil, bedrock, sand, big rock; 4 means unlabelled

export function cohenKappa(a, b) {
  const rows = new Array(CLASSES).fill(0)
  const cols = new Array(CLASSES).fill(0)
  let n = 0
  let same = 0
  a.forEach((x, i) => {
    const y = b[i]
    if (x >= CLASSES || y >= CLASSES) return
    n++
    rows[x]++
    cols[y]++
    if (x === y) same++
  })
  if (n === 0) return { kappa: 0, agreement: 0, cells: 0 }
  const po = same / n
  const pe = rows.reduce((s, r, i) => s + (r / n) * (cols[i] / n), 0)
  return { kappa: pe === 1 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe), agreement: po, cells: n }
}

function grade(path) {
  const f = JSON.parse(readFileSync(path, 'utf8'))
  const cells = f.cols * f.rows
  if (f.version !== 1 || f.student?.length !== cells || f.expert?.length !== cells)
    throw new Error('not a labels file from this app (version 1)')
  return { stop: f.stop, ...cohenKappa(f.student, f.expert) }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('usage: node scripts/grade-labels.mjs labels-*.json')
    process.exit(2)
  }
  for (const path of files) {
    try {
      const r = grade(path)
      console.log(
        `${path}\tstop ${r.stop}\t${r.cells} cells\tagreement ${(r.agreement * 100).toFixed(0)}%\tkappa ${r.kappa.toFixed(2)}`,
      )
    } catch (error) {
      console.log(`${path}\tskipped: ${error.message}`)
    }
  }
}
