import { createNoise3D, NoiseFunction3D } from 'simplex-noise';
import { CoordinateDataModel } from './pluginTypes';
//handles game coordinates

export class coordinateSurfaceModel {
    surfaceName:string;
    surfaceSeed:number;
    coordinateData:CoordinateDataModel;
    
    constructor(surfaceName, seed = Math.random()) {
        this.surfaceName = surfaceName
        this.surfaceSeed = seed
        this.coordinateData = {}
    }
}
