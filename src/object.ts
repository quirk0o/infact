export const propertyDescriptor = (key: string | number | symbol, value: any) => ({
  [key]: {
    writable: false,
    enumerable: true,
    configurable: false,
    value: value
  }
})

export const lazyPropertyDescriptor = (key: string | number | symbol, get: () => any) => ({
  [key]: {
    get,
    enumerable: true,
    configurable: false
  }
})
