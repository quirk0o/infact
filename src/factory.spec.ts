import { Factory } from './factory'

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
      const SpiderCatFactory = Factory.compose(
        CatFactory,
        SpiderFactory
      )

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
        .option('birthday')(() => new Date(2017, 7, 13))
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
        .attr('fullName')(({name}) => `${name} The Cat`)

      const cat = CatFactory.build()

      expect(cat).toEqual({
        name: 'Bibi',
        fullName: 'Bibi The Cat'
      })
    })

    it('passes sequences to attribute definition', () => {
      const CatFactory = new Factory()
        .sequence('name')(n => `Cat #${n + 1}`)
        .attr('fullName')(({ name }) => `${name} Potato`)

      const cat = CatFactory.build()

      expect(cat).toEqual({
        name: 'Cat #1',
        fullName: 'Cat #1 Potato'
      })
    })

    it('increments sequence on every build', () => {
      const CatFactory = new Factory().sequence('name')(n => `Cat #${n + 1}`)

      const cat = CatFactory.build()
      const anotherCat = CatFactory.build()

      expect(cat).toEqual({ name: 'Cat #1' })
      expect(anotherCat).toEqual({ name: 'Cat #2' })
    })

    it('uses option overrides to build object', () => {
      const CatFactory = new Factory()
        .option('birthday')(() => new Date(2017, 7, 13))
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
        .option('hungry')(() => true)
        .after(afterCallback)

      const cat = CatFactory.build()

      expect(afterCallback).toHaveBeenCalled()
      expect(cat).toEqual({ name: 'Bibi', meowing: true })
    })

    it('invokes after callbacks and returns initial object when nothing is returned', () => {
      const afterCallback = jest.fn().mockImplementation((cat, evaluator) => {
        if (evaluator.hungry) cat.meowing = true
      })
      const CatFactory = new Factory()
        .attr('name')(() => 'Bibi')
        .option('hungry')(() => true)
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
      const afterCallbackName = jest.fn().mockImplementation((cat) =>
        cat.meowing
          ? {
              ...cat,
              name: `Meowing ${cat.name}`
            }
          : cat
      )
      const CatFactory = new Factory()
        .attr('name')(() => 'Bibi')
        .option('hungry')(() => true)
        .after(afterCallbackMeowing)
        .after(afterCallbackName)

      const cat = CatFactory.build()

      expect(afterCallbackMeowing).toHaveBeenCalled()
      expect(afterCallbackName).toHaveBeenCalled()
      expect(cat).toEqual({ name: 'Meowing Bibi', meowing: true })
    })
  })

  describe('.buildList', () => {
    it('builds a list of entities', () => {
      const CatFactory = new Factory<{ name: string; sound: string }>()
        .sequence('name')(n => `Cat #${n + 1}`)
        .attr('sound')(() => 'meow')

      const cats = CatFactory.buildList(3)

      expect(cats).toEqual([
        { name: 'Cat #1', sound: 'meow' },
        { name: 'Cat #2', sound: 'meow' },
        { name: 'Cat #3', sound: 'meow' }
      ])
    })
  })
})
