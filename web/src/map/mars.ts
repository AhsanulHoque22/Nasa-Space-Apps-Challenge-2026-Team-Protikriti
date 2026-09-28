/** Mars body model shared by every Cesium object. */
import { Ellipsoid } from 'cesium'

/**
 * Mars 2000 sphere (R = 3,396,190 m), the body model of every dataset here (USGS DEM, IAU
 * gazetteer, Trek, MMGIS). On a sphere geodetic latitude == planetocentric latitude, so the
 * coordinates we display are exact. (Ellipsoid.MARS is the flattened IAU ellipsoid: using it
 * would shift planetocentric data by up to ~0.34 deg of latitude, ~20 km.)
 */
export const MARS_SPHERE = new Ellipsoid(3_396_190, 3_396_190, 3_396_190)

// Must be set before any Cesium object is created so globe, camera and tiling all use Mars.
Ellipsoid.default = MARS_SPHERE
