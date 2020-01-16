type GeneratorFn<TNext, TVal> = (value?: TVal) => GeneratorResult<TNext, TVal>

export type Generator<TNext, TVal> = {
  next: GeneratorFn<TNext, TVal>
}
export type GeneratorResult<TNext, TVal> = {
  value: TNext
  next: GeneratorFn<TNext, TVal>
}

export const generator = <TNext = any, TVal = any>(next: GeneratorFn<TNext, TVal>) => ({
  next
})

export const take = <TNext = any, TVal = any>(n: number) => (generator: Generator<TNext, TVal>) =>
  Array(n)
    .fill(null)
    .reduce(
      ([values, generator]) => {
        const next = generator.next()
        return [values.concat(next.value), next]
      },
      [[], generator]
    )[0]
