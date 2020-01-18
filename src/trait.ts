import { AttributeDefinition, AttributeType, Dict } from './types'

export type AttributesOf<T> = T extends Trait<infer A, any> ? A : never
export type OptionsOf<T> = T extends Trait<any, infer O> ? O : never

export class Trait<TRes extends object = Dict, TTrans extends object = Dict> {
  static create<TRes extends object = Dict, TTrans extends object = Dict>() {
    return new Trait<TRes, TTrans>()
  }

  static compose<TRes extends object = Dict, TTrans extends object = Dict>(
    ...traits: Trait<Partial<TRes>, Partial<TTrans>>[]
  ) {
    return traits.reduce((composedTrait, trait) => composedTrait.compose(trait))
  }

  constructor(public attributes: AttributeDefinition<TRes, TTrans>[] = []) {}

  compose<F extends Trait<any, any>>(
    trait: F
  ): Trait<TRes & AttributesOf<F>, TTrans & OptionsOf<F>> {
    type AF = AttributesOf<F>
    type AO = OptionsOf<F>
    type AR = TRes & AttributesOf<F>
    type OR = TTrans & OptionsOf<F>
    return new Trait<AR, OR>(
      (this.attributes as (
        | AttributeDefinition<TRes, TTrans>
        | AttributeDefinition<AF, AO>
      )[]).concat(trait.attributes)
    )
  }

  seq<K extends keyof TRes>(
    key: K,
    initial: number = 0,
    step: number = 1
  ): (definition: (n: number, attrs: TRes & TTrans) => TRes[K]) => Trait<TRes, TTrans> {
    return definition => {
      return new Trait(
        this.attributes.concat({
          type: AttributeType.Sequence,
          key,
          step,
          get: definition,
          seq: initial
        })
      )
    }
  }

  opt<K extends keyof TTrans>(
    key: K
  ): (definition: (attrs: TRes & TTrans) => TTrans[K]) => Trait<TRes, TTrans> {
    return definition => {
      return new Trait(
        this.attributes.concat({ type: AttributeType.Transient, key, get: definition })
      )
    }
  }

  attr<K extends keyof TRes>(
    key: K
  ): (definition: (attrs: TRes & TTrans) => TRes[K]) => Trait<TRes, TTrans> {
    return definition => {
      return new Trait(
        this.attributes.concat({ type: AttributeType.Property, key, get: definition })
      )
    }
  }
}
