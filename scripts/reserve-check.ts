import { buyAircraft, newGame, openRoute, assignAircraft, advanceDay } from '../src/game/engine'
import { setAircraftReserve, suggestedReserveCount, getSubstituteMap } from '../src/game/reserve'

async function run() {
  console.log('Testing Reserve & Maintenance System...')

  const state = newGame({ name: 'TestAir', code: 'TA', hub: 'GRU' })

  // Buy 3 aircraft of same model (e.g. e195e2)
  const ac1 = buyAircraft(state, 'e195e2', false)
  const ac2 = buyAircraft(state, 'e195e2', false)
  const ac3 = buyAircraft(state, 'e195e2', false)

  if (ac1 || ac2 || ac3) {
    throw new Error(`Failed to buy aircraft: ${ac1 || ac2 || ac3}`)
  }

  const plane1 = state.airline.fleet[0]
  const plane2 = state.airline.fleet[1]
  const plane3 = state.airline.fleet[2]

  console.log(`Bought 3 planes: ${plane1.reg}, ${plane2.reg}, ${plane3.reg}`)

  // Open route GRU-GIG
  const routeErr = openRoute(state, 'GRU', 'GIG')
  if (routeErr) throw new Error(`Failed to open route: ${routeErr}`)
  const route = state.airline.routes[0]

  // Assign plane1 to route
  const assignErr = assignAircraft(state, plane1.id, route.id)
  if (assignErr) throw new Error(`Failed to assign aircraft: ${assignErr}`)

  // Allocate plane3 as reserve
  const resErr = setAircraftReserve(state, plane3.id, true)
  if (resErr) throw new Error(`Failed to set reserve: ${resErr}`)

  if (!plane3.isReserve) throw new Error('Plane 3 is not marked as reserve')

  // Check suggested count
  const suggested = suggestedReserveCount(state, 'e195e2')
  console.log(`Suggested reserve count for e195e2: ${suggested}`)
  if (suggested < 1) throw new Error('Suggested reserve should be at least 1')

  // Ground plane1 for maintenance
  plane1.groundedUntil = state.day + 5
  console.log(`${plane1.reg} is now grounded until day ${plane1.groundedUntil}`)

  // Check substitute map
  const subMap = getSubstituteMap(state, state.day)
  console.log(`Substitute map size: ${subMap.size}`)
  if (!subMap.has(plane1.id)) throw new Error('Grounded plane1 not in substitute map')
  if (subMap.get(plane1.id)?.id !== plane3.id) throw new Error('Plane3 is not substitute for Plane1')

  // Advance day and check simulation
  const hoursBeforePlane3 = plane3.hours
  advanceDay(state)

  console.log(`Plane 3 hours before: ${hoursBeforePlane3}, after: ${plane3.hours}`)
  if (plane3.hours <= hoursBeforePlane3) {
    throw new Error('Reserve plane 3 should have flown the flights for grounded plane 1')
  }

  console.log('✅ Reserve check passed successfully!')
}

run().catch((err) => {
  console.error('❌ Reserve check failed:', err)
  process.exit(1)
})
