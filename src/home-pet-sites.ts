import {HOME_PET_IDS,type HomePetId} from '../shared/home-pets';import type {AnimalSite} from './animal-schedule';
export const HOME_PET_SITES:Record<HomePetId,AnimalSite&{species:'kangaroo'|'koala'|'sea-turtle'}>={
 'home-kangaroo':{id:'home-kangaroo',species:'kangaroo',regionId:'player-home-villa',x:-24,z:40,y:.26,clearance:.95,height:4,cycles:6,offset:0},
 'home-koala':{id:'home-koala',species:'koala',regionId:'player-home-villa',x:-34.2,z:28,y:.26,clearance:.72,height:1.5,cycles:8,offset:0},
 'home-sea-turtle':{id:'home-sea-turtle',species:'sea-turtle',regionId:'player-home-villa',x:13,z:28.7,y:-.61,clearance:2.5,height:1.16,cycles:1,offset:0,water:true},
};
export const HOME_ANIMAL_SITES=HOME_PET_IDS.map(id=>HOME_PET_SITES[id]);
