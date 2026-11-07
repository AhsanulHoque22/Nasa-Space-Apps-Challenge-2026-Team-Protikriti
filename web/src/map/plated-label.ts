/**
 * Mission map labels on a solid plate: coloured text with only an outline vanished on bright,
 * grey HiRISE ground. Light text on a near-black plate reads on any ground; an alert is white on
 * brick (6.3:1).
 */
import { Cartesian2, Color, LabelStyle, VerticalOrigin } from 'cesium'

export const PLATE = Color.fromCssColorString('#05070C').withAlpha(0.85)
export const ALERT_PLATE = Color.fromCssColorString('#a8341f').withAlpha(0.95)

export function platedLabel(text: string, fill = Color.WHITE, size = 14, plate = PLATE) {
  return {
    text,
    font: `600 ${size}px Atkinson, system-ui, sans-serif`,
    fillColor: fill,
    style: LabelStyle.FILL,
    showBackground: true,
    backgroundColor: plate,
    backgroundPadding: new Cartesian2(8, 5),
    verticalOrigin: VerticalOrigin.BOTTOM,
    pixelOffset: new Cartesian2(0, -16),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  }
}
