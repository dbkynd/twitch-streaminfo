/* global Vue, Vuetify */

new Vue({
  el: '#app',
  vuetify: new Vuetify(),

  data() {
    return {
      color: '#141414',
      terms: [],
      headers: [
        { text: 'Term', value: 'term' },
        { text: 'Actions', value: 'actions', sortable: false, align: 'end' },
      ],
      dialog: false,
      valid: true,
      editedIndex: -1,
      editedItem: {
        term: '',
      },
      defaultItem: {
        term: '',
      },
      rules: {
        required: (v) => !!v || 'Required.',
        noSpace: (v) =>
          (v || '').indexOf(' ') < 0 ||
          'No spaces allowed. Single word entries only.',
      },
    }
  },

  computed: {
    formTitle() {
      return this.editedIndex === -1 ? 'New Term' : 'Edit Term'
    },
  },

  watch: {
    dialog(val) {
      if (val) return val
      this.close()
    },
  },

  created() {
    axios.get('/term').then(({ data }) => {
      this.terms = data
    })
  },

  methods: {
    editItem(item) {
      this.editedIndex = this.terms.indexOf(item)
      this.editedItem = Object.assign({}, item)
      this.dialog = true
    },

    deleteItem(item) {
      // delete a term from the database
      const index = this.terms.indexOf(item)
      confirm('Are you sure you want to delete this term?') &&
        axios
          .delete('/term', { data: { _id: item._id } })
          .then(() => {
            this.terms.splice(index, 1)
          })
          .catch(() => {
            alert('There was an error removing the term from the database.')
          })
    },

    close() {
      this.dialog = false
      setTimeout(() => {
        this.editedItem = Object.assign({}, this.defaultItem)
        this.editedIndex = -1
        this.$refs.form.reset()
      }, 300)
    },

    enter() {
      this.$refs.form.validate()
      if (this.valid) this.save()
    },

    save() {
      if (!this.valid) return
      if (this.editedIndex > -1) {
        // update a term in the database
        axios
          .patch('/term', this.editedItem)
          .then(({ data }) => {
            Object.assign(this.terms[this.editedIndex], data)
          })
          .catch(() => {
            alert('There was an error updating the term in the database.')
          })
          .finally(() => {
            this.close()
          })
      } else {
        // add a new term to the database
        axios
          .post('/term', { term: this.editedItem.term })
          .then(({ data: added }) => {
            this.terms.push(added)
          })
          .catch(() => {
            alert('There was an error adding the term to the database.')
          })
          .finally(() => {
            this.close()
          })
      }
    },
  },
})
