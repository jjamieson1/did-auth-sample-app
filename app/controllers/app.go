package controllers

import (
	"encoding/json"
	"github.com/revel/revel"
	"gopkg.in/resty.v1"
	"log"
)

type App struct {
	*revel.Controller
}

type DidUser struct {
	 Id 	string `json:"id"`
	 FirstName	string	`json:"firstName"`
	 LastName	string	`json:"lastName"`
	 EmailAddress	string	`json:"emailAddress"`
	 PublicKey 		string 	`json:"publicKey"`
}

func (c App) Index() revel.Result {
	return c.Render()
}

func (c App) ProcessDidAuth(token string) revel.Result {

	var didUser DidUser
	///did-auth/challenge/{nonce}/user
	url := "https://eeze.io/did-auth/challenge/" + token + "/user"

	log.Printf("Calling %v", url)

	resp, err := resty.R().
		SetHeader("Accept", "application/json").
		SetHeader("Authorization", "adbcc652-c0f0-4692-a264-7ca3a864a57a").
		Get(url)
	if err != nil {
		log.Printf("Error with the nonce.")
		c.Flash.Error("Error validating the response, error: %v", err.Error())
	}
	log.Printf("Body = %s", resp.Body())
	err = json.Unmarshal(resp.Body(), &didUser)
	if err != nil {
		log.Printf("Error getting a response from the nonce. error: %v", err.Error())
		c.Flash.Error("Error logging you in: error, %v", err.Error())
		return c.Redirect(App.Index)
	}
	log.Printf("Response : %v", resp.Body())
	log.Printf("Logged in user: %v, %v, %v, %v, %v", didUser.FirstName,didUser.LastName,didUser.EmailAddress, didUser.PublicKey,didUser.Id )
	c.Session["firstName"] = didUser.FirstName
	c.Session["lastName"] = didUser.LastName
	c.Session["email"] = didUser.EmailAddress
	c.Session["publicKey"] = didUser.PublicKey
	c.Session["id"] = didUser.Id

	return c.Redirect(Authenticated.Index)
}