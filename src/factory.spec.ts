import { Factory } from './factory'
import { Trait } from './trait'
import * as util from 'util'

expect.addSnapshotSerializer({
  test: val => val,
  print: (val: any) => util.format(val)
})

describe('Factory', () => {
  describe('#create', () => {
    it('creates a new factory', () => {
      expect(Factory.create()).toBeInstanceOf(Factory)
    })
  })

  describe('#compose', () => {
    it('combines a set of factories', () => {
      const CatFactory = new Factory().attr('name')(() => 'Bibi')
      const SpiderFactory = new Factory().attr('canItSwing')(() => true)
      const SpiderCatFactory = Factory.compose(CatFactory, SpiderFactory)

      const spiderCat = SpiderCatFactory.build()

      expect(spiderCat).toEqual({ name: 'Bibi', canItSwing: true })
    })
  })

  describe('.build', () => {
    it('builds object with set attributes', () => {
      const CatFactory = new Factory()
        .attr('name')(() => 'Bibi')
        .attr('age')(() => 3)

      const cat = CatFactory.build()

      expect(cat).toEqual({
        name: 'Bibi',
        age: 3
      })
    })

    it('builds object with attribute overrides', () => {
      const CatFactory = new Factory()
        .attr('name')(() => 'Bibi')
        .attr('age')(() => 3)

      const cat = CatFactory.build({ age: 4 })

      expect(cat).toEqual({
        name: 'Bibi',
        age: 4
      })
    })

    it('passes options to attribute definition', () => {
      const CatFactory = new Factory()
        .opt('birthday')(() => new Date(2017, 7, 13))
        .attr('name')(() => 'Bibi')
        .attr('age')(
        ({ birthday }) =>
          (new Date(2019, 7, 13).getTime() - birthday.getTime()) / 1000 / 60 / 60 / 24 / 365
      )

      const cat = CatFactory.build()

      expect(cat).toEqual({
        name: 'Bibi',
        age: 2
      })
    })

    it('passes attributes to attribute definition', () => {
      const CatFactory = new Factory()
        .attr('name')(() => 'Bibi')
        .attr('fullName')(({ name }) => `${name} The Cat`)

      const cat = CatFactory.build()

      expect(cat).toEqual({
        name: 'Bibi',
        fullName: 'Bibi The Cat'
      })
    })

    it('passes sequences to attribute definition', () => {
      const CatFactory = new Factory()
        .seq('name')(n => `Cat #${n + 1}`)
        .attr('fullName')(({ name }) => `${name} Potato`)

      const cat = CatFactory.build()

      expect(cat).toEqual({
        name: 'Cat #1',
        fullName: 'Cat #1 Potato'
      })
    })

    it('uses option overrides to build object', () => {
      const CatFactory = new Factory()
        .opt('birthday')(() => new Date(2017, 7, 13))
        .attr('name')(() => 'Bibi')
        .attr('age')(
        ({ birthday }) =>
          (new Date(2019, 7, 13).getTime() - birthday.getTime()) / 1000 / 60 / 60 / 24 / 365
      )

      const cat = CatFactory.build({ birthday: new Date(2016, 7, 13) })

      expect(cat).toEqual({
        name: 'Bibi',
        age: 3
      })
    })

    it('memoizes attribute value', () => {
      const nameGenerator = jest
        .fn()
        .mockReturnValueOnce('Bibi')
        .mockReturnValueOnce('Fluffy')

      const CatFactory = new Factory()
        .attr('name')(nameGenerator)
        .attr('fullName')(({ name }) => `Fluffy ${name}`)

      expect(CatFactory.build()).toEqual({
        name: 'Bibi',
        fullName: 'Fluffy Bibi'
      })
    })

    it('returns a plain JS object', () => {
      const CatFactory = new Factory()
        .attr('name')(() => 'Bibi')
        .attr('fullName')(({ name }) => `Fluffy ${name}`)

      expect(CatFactory.build()).toMatchSnapshot()
    })
  })

  describe('.buildList', () => {
    it('builds a list of entities', () => {
      const CatFactory = new Factory<{ name: string; sound: string }>()
        .seq('name')(n => `Cat #${n + 1}`)
        .attr('sound')(() => 'meow')

      const cats = CatFactory.buildList(3)

      expect(cats).toEqual([
        { name: 'Cat #1', sound: 'meow' },
        { name: 'Cat #2', sound: 'meow' },
        { name: 'Cat #3', sound: 'meow' }
      ])
    })
  })

  describe('.seq', () => {
    it('increments sequence on every build', () => {
      const CatFactory = new Factory().seq('name')(n => `Cat #${n + 1}`)

      const cat = CatFactory.gen().next().value
      const anotherCat = CatFactory.gen()
        .next()
        .next().value

      expect(cat).toEqual({ name: 'Cat #1' })
      expect(anotherCat).toEqual({ name: 'Cat #2' })
    })

    describe('when initial value and step provided', () => {
      it('increments sequence by step on every build', () => {
        const CatFactory = new Factory().seq('name', 1, 2)(n => `Cat #${n}`)

        const cat = CatFactory.gen().next().value
        const anotherCat = CatFactory.gen()
          .next()
          .next().value

        expect(cat).toEqual({ name: 'Cat #1' })
        expect(anotherCat).toEqual({ name: 'Cat #3' })
      })
    })
  })

  describe('.after', () => {
    describe('after build', () => {
      it('invokes after callbacks and returns modified object', () => {
        const afterCallback = jest.fn().mockImplementation((cat, evaluator) =>
          evaluator.hungry
            ? {
                ...cat,
                meowing: true
              }
            : cat
        )
        const CatFactory = new Factory()
          .attr('name')(() => 'Bibi')
          .opt('hungry')(() => true)
          .after(afterCallback)

        const cat = CatFactory.build()

        expect(afterCallback).toHaveBeenCalled()
        expect(cat).toEqual({ name: 'Bibi', meowing: true })
      })

      it('invokes after callbacks in order they are added', () => {
        const afterCallbackMeowing = jest.fn().mockImplementation((cat, evaluator) =>
          evaluator.hungry
            ? {
                ...cat,
                meowing: true
              }
            : cat
        )
        const afterCallbackName = jest.fn().mockImplementation(cat =>
          cat.meowing
            ? {
                ...cat,
                name: `Meowing ${cat.name}`
              }
            : cat
        )
        const CatFactory = new Factory()
          .attr('name')(() => 'Bibi')
          .opt('hungry')(() => true)
          .after(afterCallbackMeowing)
          .after(afterCallbackName)

        const cat = CatFactory.build()

        expect(afterCallbackMeowing).toHaveBeenCalled()
        expect(afterCallbackName).toHaveBeenCalled()
        expect(cat).toEqual({ name: 'Meowing Bibi', meowing: true })
      })

      it('returns unmodified object when nothing is returned from callback', () => {
        const callback = jest.fn()
        const CatFactory = new Factory()
          .attr('name')(() => 'Bibi')
          .after(callback)

        const cat = CatFactory.build()
        expect(callback).toHaveBeenCalled()
        expect(cat).toEqual({ name: 'Bibi' })
      })
    })
  })

  describe('.trait', () => {
    it('supports all attribute methods of Factory', () => {
      const CatFactory = new Factory().trait('super')(t =>
        t
          .seq(
            'snacksEaten',
            1,
            2
          )(n => n)
          .attr('name')(({ hungry }) => (hungry ? 'Hungry Bibi' : 'Super Bibi'))
          .opt('hungry')(() => false)
      )

      const cat = CatFactory.build('super', { hungry: true })

      expect(cat).toEqual({
        snacksEaten: 1,
        name: 'Hungry Bibi'
      })
    })

    it('overrides previously declared attributes', () => {
      const CatFactory = new Factory()
        .attr('sound')(() => 'meow')
        .trait('mad')(t => t.attr('sound')(() => 'raaawrr'))

      expect(CatFactory.build()).toEqual({ sound: 'meow' })
      expect(CatFactory.build('mad')).toEqual({ sound: 'raaawrr' })
    })

    describe('when passed a function', () => {
      it('creates a new trait', () => {
        const CatFactory = new Factory()
          .attr('name')(() => 'Bibi')
          .attr('age')(() => 4)
          .trait('super')(t =>
          t
            .attr('name')(() => 'Super Bibi')
            .attr('power')(() => 'High Pitched Meow')
        )

        const cat = CatFactory.build('super', { age: 3 })

        expect(cat).toEqual({
          name: 'Super Bibi',
          age: 3,
          power: 'High Pitched Meow'
        })
      })
    })

    describe('when passed a trait', () => {
      it('uses the trait', () => {
        const CatFactory = new Factory()
          .attr('name')(() => 'Bibi')
          .attr('age')(() => 4)
          .trait('super')(
          new Trait()
            .attr('name')(() => 'Super Bibi')
            .attr('power')(() => 'High Pitched Meow')
        )

        const cat = CatFactory.build('super', { age: 3 })

        expect(cat).toEqual({
          name: 'Super Bibi',
          age: 3,
          power: 'High Pitched Meow'
        })
      })
    })

    describe('when passed a mixed trait', () => {
      it('uses the trait', () => {
        const SuperTrait = new Trait().attr('power')(() => 'Superpower')
        const SpiderTrait = new Trait().attr('canSwing')(() => true)

        const SuperSpiderTrait = Trait.compose(SuperTrait, SpiderTrait)

        const SpiderCatFactory = new Factory()
          .attr('name')(() => 'Bibi')
          .attr('age')(() => 4)
          .trait('super')(SuperSpiderTrait)

        const cat = SpiderCatFactory.build('super', { age: 3 })

        expect(cat).toEqual({
          name: 'Bibi',
          age: 3,
          power: 'Superpower',
          canSwing: true
        })
      })
    })
  })
})
