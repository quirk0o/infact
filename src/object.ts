export const propertyDescriptor = (key: string | number | symbol, value: any) => ({
  [key]: {
    writable: false,
    enumerable: true,
    configurable: false,
    value: value
  }
})

export const lazyPropertyDescriptor = (key: string | number | symbol, get: () => any) => {
  let value: any
  const getter = () => {
    value = value || get()
    return value
  }
  return {
    [key]: {
      get: getter,
      enumerable: true,
      configurable: false
    }
  }
}
