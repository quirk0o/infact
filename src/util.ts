export type Path = (string | symbol | number)[]

export const path = <T extends object, R = any>(path: Path) => (obj?: T): R =>
  (path.reduce((obj, key) => {
    if (!obj) return
    return (obj as any)[key]
  }, obj) as any) as R

export const mergeAll = <T extends object = object>(...objs: object[]): T =>
  objs.reduce((result, obj) => Object.assign(result, obj), {}) as T
