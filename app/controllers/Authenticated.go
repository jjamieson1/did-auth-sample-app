package controllers

import (
	"github.com/revel/revel"
	"log"
)

type Authenticated struct {
	*revel.Controller
}

func (c Authenticated) Index(token string) revel.Result {
	var didUser DidUser
	var err error
	err = c.Session.Set("firstName", didUser.FirstName)
	err = c.Session.Set("lastName", didUser.LastName)
	err = c.Session.Set("emailAddress", didUser.EmailAddress)
	err = c.Session.Set("publicKey", didUser.PublicKey)
	err = c.Session.Set("id", didUser.Id)

	if err != nil {
		log.Printf("Unable to set sessions: %s", err.Error())
	}


	return c.Render(didUser)
}

func IsUserAuthenticated(c *revel.Controller) revel.Result {
	if c.Session["id"] == "" {
		c.Flash.Error("Please log in first")
		return c.Redirect(App.Index)
	}
	return nil
}