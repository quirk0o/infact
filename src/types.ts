import { Factory } from './factory'
import { Trait } from './trait'

export type Dict = { [key: string]: any }

export type AfterCallback<TRes, TTrans, R extends TRes = TRes> = (
  entity: TRes,
  evaluator: TRes & TTrans
) => R

export enum AttributeType {
  Sequence = 'SEQ',
  Property = 'PROP',
  Transient = 'TRANS'
}

export type AttributeDefinition<TRes = Dict, TTrans = Dict> =
  | PropertyDefinition<TRes, TTrans>
  | SequenceDefinition<TRes, TTrans>
  | TransientDefinition<TRes, TTrans>

export type PropertyDefinition<TRes = Dict, TTrans = Dict> = {
  type: AttributeType.Property
  key: keyof TRes
  get: (attrs: TRes & TTrans) => TRes[keyof TRes]
}
export type SequenceDefinition<TRes = Dict, TTrans = Dict> = {
  type: AttributeType.Sequence
  key: keyof TRes
  get: (n: number, attrs: TRes & TTrans) => TRes[keyof TRes]
  seq: number
}
export type TransientDefinition<TRes = Dict, TTrans = Dict> = {
  type: AttributeType.Transient
  key: keyof TTrans
  get: (attrs: TRes & TTrans) => TTrans[keyof TTrans]
}

export type TraitOf<F> = Trait<Partial<AttributesOf<F>>, Partial<OptionsOf<F>>>
export type AttributesOf<F> = F extends Factory<infer A, any> ? A : never
export type OptionsOf<F> = F extends Factory<any, infer O> ? O : never

export type TraitFactory<F> = (t: TraitOf<F>) => TraitOf<F>
