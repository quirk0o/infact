export type Path = (string | symbol | number)[]

export const path = <T extends object, R = any>(path: Path) => (obj?: T): R =>
  (path.reduce((obj, key) => {
    if (!obj) return
    return (obj as any)[key]
  }, obj) as any) as R

export const mergeAll = <T extends object = object>(...objs: object[]): T =>
  objs.reduce((result, obj) => Object.assign(result, obj), {}) as T

export const isObject = <T extends object>(maybeObj?: any): maybeObj is T =>
  typeof maybeObj === 'object' && maybeObj !== null

export const concat = <T, U, M>(a1: T[], a2: U[]): M[] =>
  ((a1 as (T | U)[]).concat(a2) as any) as M[]
export const concatAll = <T, U, M>(...as: (T | U)[][]): M[] =>
  (as.reduce((acc, a) => acc.concat(a)) as any) as M[]
