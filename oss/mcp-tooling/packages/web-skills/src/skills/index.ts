import { createRegistry } from '../registry.js'
import { genericWebPage } from './generic.js'
import { reddit } from './reddit.js'
import { x } from './x.js'
import { linkedin } from './linkedin.js'
import { amazon } from './amazon.js'
import { booking } from './booking.js'
import { airbnb } from './airbnb.js'

export { genericWebPage, reddit, x, linkedin, amazon, booking, airbnb }

export const defaultRegistry = createRegistry([
  genericWebPage,
  reddit,
  x,
  linkedin,
  amazon,
  booking,
  airbnb,
])
